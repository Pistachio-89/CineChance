/**
 * Taste Match Algorithm (Pattern 1)
 * 
 * Recommends movies based on what similar users have watched.
 * Uses TasteMap similarity from Phase 10 to find users with similar tastes.
 * 
 * Score formula: (similarity * 0.5) + (rating * 0.3) + (cooccurrence * 0.2)
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
import { getSimilarUsers, computeSimilarity } from '@/lib/taste-map/similarity';
import { getTasteMap } from '@/lib/taste-map/redis';
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'taste_match_v1';
const MIN_USER_HISTORY = 10;
const SIMILARITY_THRESHOLD = 0.7;
const MAX_SIMILAR_USERS = 20;
const TOP_MOVIES_PER_USER = 10;
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  similarity: 0.5,
  rating: 0.3,
  cooccurrence: 0.2,
};

/**
 * Taste Match recommendation algorithm
 */
export const tasteMatch: IRecommendationAlgorithm = {
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
        logger.info('Taste Match: cold start user', {
          userId,
          watchedCount,
          minRequired: MIN_USER_HISTORY,
          context: 'TasteMatch',
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

      // 2. Get similar users from cache or compute
      const similarUsers = await getOrComputeSimilarUsers(userId);

      if (similarUsers.length === 0) {
        logger.info('Taste Match: no similar users found', {
          userId,
          context: 'TasteMatch',
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

      // 3. Fetch top watched movies from similar users
      const candidateMovies = await fetchCandidateMovies(similarUsers, userId);

      if (candidateMovies.length === 0) {
        logger.info('Taste Match: no candidate movies', {
          userId,
          similarUsersCount: similarUsers.length,
          context: 'TasteMatch',
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

      // 4. Calculate scores for each candidate
      const scoredCandidates = calculateCandidateScores(candidateMovies, similarUsers);

      // 5. Apply cooldown filter
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
        logger.info('Taste Match: all candidates filtered by cooldown', {
          userId,
          initialPoolSize,
          excludedCount: excludedKeys.size,
          context: 'TasteMatch',
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

      // 6. Normalize scores to 0-100
      const normalizedCandidates = normalizeScores(filteredCandidates);

      // 7. Sort by score descending and take top N
      const topCandidates = normalizedCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      // 8. Build final recommendations
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
      logger.info('Taste Match: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        durationMs: duration,
        context: 'TasteMatch',
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
      logger.error('Taste Match: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'TasteMatch',
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

/**
 * Get similar users from cache or compute fresh
 */
async function getOrComputeSimilarUsers(
  userId: string
): Promise<{ userId: string; overallMatch: number }[]> {
  // Try to get from cache first
  const cached = await getSimilarUsers(userId);
  
  if (cached.length > 0) {
    return cached
      .filter(u => u.overallMatch >= SIMILARITY_THRESHOLD)
      .slice(0, MAX_SIMILAR_USERS);
  }

  // If no cache, compute similarity for all other users
  const allUserIds = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true },
  });

  const candidateIds = allUserIds.map(u => u.id);

  // Compute similarities
  const similarUsers: { userId: string; overallMatch: number }[] = [];

  for (const candidateId of candidateIds) {
    try {
      const result = await computeSimilarity(userId, candidateId);
      
      if (result.tasteSimilarity >= SIMILARITY_THRESHOLD) {
        similarUsers.push({
          userId: candidateId,
          overallMatch: result.overallMatch,
        });
      }
    } catch {
      // Skip users with errors
    }
  }

  // Sort by match score and limit
  return similarUsers
    .sort((a, b) => b.overallMatch - a.overallMatch)
    .slice(0, MAX_SIMILAR_USERS);
}

/**
 * Fetch top watched movies from similar users
 */
async function fetchCandidateMovies(
  similarUsers: { userId: string; overallMatch: number }[],
  excludeUserId: string
): Promise<CandidateMovie[]> {
  const watchedStatusIds = await getWatchedStatusIds();
  const movieMap = new Map<string, CandidateMovie>();

  for (const similarUser of similarUsers) {
    // Get top rated movies from this user
    const userMovies = await prisma.watchList.findMany({
      where: {
        userId: similarUser.userId,
        statusId: { in: watchedStatusIds },
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
        const totalSimilarity = existing.similarityScore * (existing.cooccurrenceCount - 1) + similarUser.overallMatch;
        existing.similarityScore = totalSimilarity / existing.cooccurrenceCount;
      } else {
        // Create new entry
        movieMap.set(key, {
          tmdbId: movie.tmdbId,
          mediaType: movie.mediaType,
          title: movie.title || `Movie ${movie.tmdbId}`,
          userRating: movie.userRating,
          voteAverage: movie.voteAverage || 0,
          similarityScore: similarUser.overallMatch,
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
  similarUsers: { userId: string; overallMatch: number }[]
): (CandidateMovie & { score: number })[] {
  const maxCooccurrence = Math.max(...candidates.map(c => c.cooccurrenceCount), 1);

  return candidates.map(candidate => {
    // Normalize components
    const similarityNorm = candidate.similarityScore; // Already 0-1
    const ratingNorm = (candidate.userRating ?? candidate.voteAverage / 2) / 10; // 0-1 scale
    const cooccurrenceNorm = candidate.cooccurrenceCount / maxCooccurrence; // 0-1 relative

    // Weighted sum
    const rawScore =
      similarityNorm * WEIGHTS.similarity +
      ratingNorm * WEIGHTS.rating +
      cooccurrenceNorm * WEIGHTS.cooccurrence;

    return {
      ...candidate,
      score: rawScore,
    };
  });
}

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

export default tasteMatch;
