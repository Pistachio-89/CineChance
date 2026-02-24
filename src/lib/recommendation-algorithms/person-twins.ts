/**
 * Person Twins Algorithm (Pattern 7)
 *
 * Recommends movies based on users who share favorite actors/directors.
 * Uses person overlap (Jaccard similarity) from TasteMap to find users
 * with similar favorite persons and recommends their highly-rated movies.
 *
 * Score formula: (personSimilarity * 0.5) + (rating * 0.3) + (cooccurrence * 0.2)
 */

import type {
  IRecommendationAlgorithm,
  RecommendationContext,
  RecommendationSession,
  RecommendationResult,
  RecommendationItem,
  CandidateMovie,
} from './interface';
import { normalizeScores, DEFAULT_COOLDOWN } from './interface';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { personOverlap, getSimilarUsers } from '@/lib/taste-map/similarity';
import { getPersonProfile } from '@/lib/taste-map/redis';
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'person_twins_v1';
const MIN_USER_HISTORY = 10;
const PERSON_SIMILARITY_THRESHOLD = 0.5;
const MAX_PERSON_TWINS = 15;
const TOP_MOVIES_PER_USER = 10;
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  personSimilarity: 0.5,
  rating: 0.3,
  cooccurrence: 0.2,
};

/**
 * Get status IDs for watched content
 */
async function getWatchedStatusIds(): Promise<number[]> {
  const statuses = await prisma.movieStatus.findMany({
    where: {
      OR: [
        { name: 'Просмотрено' },
        { name: 'Пересмотрено' },
      ],
    },
    select: { id: true },
  });

  return statuses.map(s => s.id);
}

/**
 * Find users with similar favorite persons using Jaccard overlap
 */
async function findPersonSimilarUsers(
  userId: string,
  personProfile: { actors: Record<string, number>; directors: Record<string, number> }
): Promise<{ userId: string; personSimilarity: number }[]> {
  // Try to get from cache first
  const cached = await getSimilarUsers(userId);

  if (cached.length > 0) {
    // Filter by person overlap threshold
    return cached
      .map(u => ({ userId: u.userId, personSimilarity: u.overallMatch }))
      .filter(u => u.personSimilarity >= PERSON_SIMILARITY_THRESHOLD)
      .slice(0, MAX_PERSON_TWINS);
  }

  // If no cache, compute person overlap for all other users
  const allUserIds = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true },
  });

  const candidateIds = allUserIds.map(u => u.id);

  const personSimilarUsers: { userId: string; personSimilarity: number }[] = [];

  for (const candidateId of candidateIds) {
    try {
      const candidateProfile = await getPersonProfile(candidateId);

      if (candidateProfile) {
        // Compute person overlap (average of actor and director overlap)
        const actorsOverlap = personOverlap(personProfile.actors, candidateProfile.actors);
        const directorsOverlap = personOverlap(personProfile.directors, candidateProfile.directors);
        const personSimilarity = (actorsOverlap + directorsOverlap) / 2;

        if (personSimilarity >= PERSON_SIMILARITY_THRESHOLD) {
          personSimilarUsers.push({
            userId: candidateId,
            personSimilarity,
          });
        }
      }
    } catch {
      // Skip users with errors
    }
  }

  // Sort by similarity score and limit
  return personSimilarUsers
    .sort((a, b) => b.personSimilarity - a.personSimilarity)
    .slice(0, MAX_PERSON_TWINS);
}

/**
 * Fetch top-rated watched movies from person-similar users
 */
async function fetchCandidateMovies(
  personSimilarUsers: { userId: string; personSimilarity: number }[],
  excludeUserId: string
): Promise<CandidateMovie[]> {
  const watchedStatusIds = await getWatchedStatusIds();
  const movieMap = new Map<string, CandidateMovie>();

  for (const similarUser of personSimilarUsers) {
    // Get top rated movies from this user
    const userMovies = await prisma.watchList.findMany({
      where: {
        userId: similarUser.userId,
        statusId: { in: watchedStatusIds },
        userRating: { gte: 7 }, // High rating threshold
      },
      select: {
        tmdbId: true,
        mediaType: true,
        title: true,
        userRating: true,
        voteAverage: true,
      },
      orderBy: [
        { userRating: 'desc' },
        { voteAverage: 'desc' },
      ],
      take: TOP_MOVIES_PER_USER,
    });

    for (const movie of userMovies) {
      const key = `${movie.tmdbId}_${movie.mediaType}`;

      const existing = movieMap.get(key);
      if (existing) {
        // Update existing entry
        existing.cooccurrenceCount += 1;
        existing.sourceUserIds.push(similarUser.userId);
        // Update similarity score to average
        const totalSimilarity = existing.similarityScore * (existing.cooccurrenceCount - 1) + similarUser.personSimilarity;
        existing.similarityScore = totalSimilarity / existing.cooccurrenceCount;
      } else {
        // Create new entry
        movieMap.set(key, {
          tmdbId: movie.tmdbId,
          mediaType: movie.mediaType,
          title: movie.title || `Movie ${movie.tmdbId}`,
          userRating: movie.userRating,
          voteAverage: movie.voteAverage || 0,
          similarityScore: similarUser.personSimilarity,
          cooccurrenceCount: 1,
          sourceUserIds: [similarUser.userId],
        });
      }
    }
  }

  return Array.from(movieMap.values());
}

/**
 * Calculate weighted scores for candidates
 */
function calculateCandidateScores(
  candidates: CandidateMovie[],
  personSimilarUsers: { userId: string; personSimilarity: number }[]
): (CandidateMovie & { score: number })[] {
  const maxCooccurrence = Math.max(...candidates.map(c => c.cooccurrenceCount), 1);

  return candidates.map(candidate => {
    // Normalize components
    const personSimilarityNorm = candidate.similarityScore; // Already 0-1
    const ratingNorm = (candidate.userRating ?? candidate.voteAverage / 2) / 10; // 0-1 scale
    const cooccurrenceNorm = candidate.cooccurrenceCount / maxCooccurrence; // 0-1 relative

    // Weighted sum
    const rawScore =
      personSimilarityNorm * WEIGHTS.personSimilarity +
      ratingNorm * WEIGHTS.rating +
      cooccurrenceNorm * WEIGHTS.cooccurrence;

    return {
      ...candidate,
      score: rawScore,
    };
  });
}

/**
 * Person Twins recommendation algorithm
 *
 * Finds users with similar favorite actors/directors and recommends their
 * highly-rated watched movies.
 */
export const personTwins: IRecommendationAlgorithm = {
  name: ALGORITHM_NAME,
  minUserHistory: MIN_USER_HISTORY,

  async execute(
    userId: string,
    context: RecommendationContext,
    sessionData: RecommendationSession
  ): Promise<RecommendationResult> {
    const startTime = Date.now();

    try {
      // 1. Check user's watched movie count
      const watchedStatusIds = await getWatchedStatusIds();
      const watchedCount = await prisma.watchList.count({
        where: {
          userId,
          statusId: { in: watchedStatusIds },
        },
      });

      // Cold start: not enough history
      if (watchedCount < MIN_USER_HISTORY) {
        logger.info('Person Twins: cold start user', {
          userId,
          watchedCount,
          minRequired: MIN_USER_HISTORY,
          context: 'PersonTwins',
        });
        return {
          recommendations: [],
          metrics: {
            candidatesPoolSize: 0,
            afterFilters: 0,
            avgScore: 0,
          },
        };
      }

      // 2. Get user's person profile (favorite actors + directors)
      const personProfile = await getPersonProfile(userId);

      if (!personProfile) {
        logger.info('Person Twins: no person profile available', {
          userId,
          context: 'PersonTwins',
        });
        return {
          recommendations: [],
          metrics: {
            candidatesPoolSize: 0,
            afterFilters: 0,
            avgScore: 0,
          },
        };
      }

      // 3. Find similar users via person overlap
      const personSimilarUsers = await findPersonSimilarUsers(userId, personProfile);

      if (personSimilarUsers.length === 0) {
        logger.info('Person Twins: no person-similar users found', {
          userId,
          context: 'PersonTwins',
        });
        return {
          recommendations: [],
          metrics: {
            candidatesPoolSize: 0,
            afterFilters: 0,
            avgScore: 0,
          },
        };
      }

      // 4. Fetch top-rated watched movies from person-similar users
      const candidateMovies = await fetchCandidateMovies(personSimilarUsers, userId);

      if (candidateMovies.length === 0) {
        logger.info('Person Twins: no candidate movies', {
          userId,
          personSimilarUsersCount: personSimilarUsers.length,
          context: 'PersonTwins',
        });
        return {
          recommendations: [],
          metrics: {
            candidatesPoolSize: 0,
            afterFilters: 0,
            avgScore: 0,
          },
        };
      }

      const initialPoolSize = candidateMovies.length;

      // 5. Calculate scores for each candidate
      const scoredCandidates = calculateCandidateScores(candidateMovies, personSimilarUsers);

      // 6. Apply cooldown filter
      const cooldownDate = subDays(new Date(), DEFAULT_COOLDOWN.days);
      const recentRecommendations = await prisma.recommendationLog.findMany({
        where: {
          userId,
          shownAt: { gte: cooldownDate },
        },
        select: { tmdbId: true, mediaType: true },
      });

      const excludedKeys = new Set(
        recentRecommendations.map(r => `${r.tmdbId}_${r.mediaType}`)
      );

      // Also exclude items from this session
      const filteredCandidates = scoredCandidates.filter(candidate => {
        const key = `${candidate.tmdbId}_${candidate.mediaType}`;
        return !excludedKeys.has(key) && !sessionData.previousRecommendations.has(key);
      });

      const afterFilters = filteredCandidates.length;

      if (filteredCandidates.length === 0) {
        logger.info('Person Twins: all candidates filtered by cooldown', {
          userId,
          initialPoolSize,
          excludedCount: excludedKeys.size,
          context: 'PersonTwins',
        });
        return {
          recommendations: [],
          metrics: {
            candidatesPoolSize: initialPoolSize,
            afterFilters: 0,
            avgScore: 0,
          },
        };
      }

      // 7. Normalize scores to 0-100
      const normalizedCandidates = normalizeScores(filteredCandidates);

      // 8. Sort by score descending and take top N
      const topCandidates = normalizedCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      // 9. Build final recommendations
      const recommendations: RecommendationItem[] = topCandidates.map(candidate => ({
        tmdbId: candidate.tmdbId,
        mediaType: candidate.mediaType,
        title: candidate.title,
        score: candidate.score,
        algorithm: ALGORITHM_NAME,
        sources: candidate.sourceUserIds.slice(0, 3), // Include top 3 sources
      }));

      const avgScore = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
        : 0;

      const duration = Date.now() - startTime;
      logger.info('Person Twins: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        durationMs: duration,
        context: 'PersonTwins',
      });

      return {
        recommendations,
        metrics: {
          candidatesPoolSize: initialPoolSize,
          afterFilters,
          avgScore,
        },
      };
    } catch (error) {
      logger.error('Person Twins: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'PersonTwins',
      });

      return {
        recommendations: [],
        metrics: {
          candidatesPoolSize: 0,
          afterFilters: 0,
          avgScore: 0,
        },
      };
    }
  },
};

export default personTwins;
