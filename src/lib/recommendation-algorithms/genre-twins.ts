/**
 * Genre Twins Algorithm (Pattern 5)
 *
 * Recommends movies based on users with similar genre preferences.
 * Uses TasteMap genre profiles from Phase 10 to find users with similar tastes.
 *
 * Score formula: (genreSimilarity * 0.5) + (rating * 0.3) + (cooccurrence * 0.2)
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
import { getGenreProfile, getTasteMap } from '@/lib/taste-map/redis';
import { cosineSimilarity } from '@/lib/taste-map/similarity';
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'genre_twins_v1';
const MIN_USER_HISTORY = 10;
const GENRE_SIMILARITY_THRESHOLD = 0.6;
const MAX_GENRE_TWINS = 15;
const TOP_MOVIES_PER_USER = 10;
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  genreSimilarity: 0.5,
  rating: 0.3,
  cooccurrence: 0.2,
};

/**
 * Genre Twins recommendation algorithm
 *
 * This algorithm finds users with similar genre preferences using cosine similarity
 * on genre profiles, then recommends highly-rated movies from those users.
 */
export const genreTwins: IRecommendationAlgorithm = {
  name: ALGORITHM_NAME,
  minUserHistory: MIN_USER_HISTORY,

  async execute(
    userId: string,
    context: RecommendationContext,
    sessionData: RecommendationSession
  ): Promise<RecommendationResult> {
    const startTime = Date.now();

    try {
      // 1. Check user's genre profile availability
      const userGenreProfile = await getGenreProfile(userId);

      if (!userGenreProfile) {
        logger.info('Genre Twins: no genre profile available', {
          userId,
          context: 'GenreTwins',
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

      // Check if user has any genre data
      const genreCount = Object.keys(userGenreProfile).length;
      if (genreCount === 0) {
        logger.info('Genre Twins: empty genre profile', {
          userId,
          context: 'GenreTwins',
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

      // 2. Get similar users based on genre profiles
      const similarUsers = await findGenreTwins(userId, userGenreProfile);

      if (similarUsers.length === 0) {
        logger.info('Genre Twins: no genre twins found', {
          userId,
          genreCount,
          context: 'GenreTwins',
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

      // 3. Fetch top watched movies from genre twins
      const candidateMovies = await fetchCandidateMovies(similarUsers, userId);

      if (candidateMovies.length === 0) {
        logger.info('Genre Twins: no candidate movies', {
          userId,
          similarUsersCount: similarUsers.length,
          context: 'GenreTwins',
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
        logger.info('Genre Twins: all candidates filtered by cooldown', {
          userId,
          initialPoolSize,
          excludedCount: excludedKeys.size,
          context: 'GenreTwins',
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
      logger.info('Genre Twins: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        durationMs: duration,
        context: 'GenreTwins',
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
      logger.error('Genre Twins: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'GenreTwins',
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
 * Find users with similar genre preferences
 */
async function findGenreTwins(
  userId: string,
  userGenreProfile: Record<string, number>
): Promise<{ userId: string; genreSimilarity: number }[]> {
  // Get taste map to find similar users
  const tasteMap = await getTasteMap(userId);

  if (!tasteMap) {
    return [];
  }

  // Use cosine similarity to find users with similar genre profiles
  const similarUsers: { userId: string; genreSimilarity: number }[] = [];

  // We need to compute similarity with other users
  // For efficiency, we can get all user IDs and compute similarity
  try {
    const allUsers = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true },
    });

    for (const user of allUsers) {
      try {
        const otherTasteMap = await getTasteMap(user.id);
        if (!otherTasteMap) continue;

        const similarity = cosineSimilarity(userGenreProfile, otherTasteMap.genreProfile);

        if (similarity >= GENRE_SIMILARITY_THRESHOLD) {
          similarUsers.push({
            userId: user.id,
            genreSimilarity: similarity,
          });
        }
      } catch {
        // Skip users with errors
      }
    }

    // Sort by genre similarity (highest first) and limit
    return similarUsers
      .sort((a, b) => b.genreSimilarity - a.genreSimilarity)
      .slice(0, MAX_GENRE_TWINS);
  } catch (error) {
    logger.error('Genre Twins: error finding genre twins', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      context: 'GenreTwins',
    });
    return [];
  }
}

/**
 * Fetch top watched movies from genre twins
 */
async function fetchCandidateMovies(
  similarUsers: { userId: string; genreSimilarity: number }[],
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
        const totalSimilarity = existing.similarityScore * (existing.cooccurrenceCount - 1) + similarUser.genreSimilarity;
        existing.similarityScore = totalSimilarity / existing.cooccurrenceCount;
      } else {
        // Create new entry
        movieMap.set(key, {
          tmdbId: movie.tmdbId,
          mediaType: movie.mediaType,
          title: movie.title || `Movie ${movie.tmdbId}`,
          userRating: movie.userRating,
          voteAverage: movie.voteAverage || 0,
          similarityScore: similarUser.genreSimilarity,
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
  similarUsers: { userId: string; genreSimilarity: number }[]
): (CandidateMovie & { score: number })[] {
  const maxCooccurrence = Math.max(...candidates.map(c => c.cooccurrenceCount), 1);

  return candidates.map(candidate => {
    // Normalize components
    const genreSimNorm = candidate.similarityScore; // Already 0-1
    const ratingNorm = (candidate.userRating ?? candidate.voteAverage / 2) / 10; // 0-1 scale
    const cooccurrenceNorm = candidate.cooccurrenceCount / maxCooccurrence; // 0-1 relative

    // Weighted sum
    const rawScore =
      genreSimNorm * WEIGHTS.genreSimilarity +
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

export default genreTwins;
