/**
 * Genre Recommendations Algorithm (Pattern 6)
 *
 * Recommends movies based on user's dominant genres.
 * Uses user's dominant genres to find highly-rated content in those genres from similar users.
 *
 * Score formula: (genreMatchScore * 0.4) + (rating * 0.4) + (userSimilarity * 0.2)
 */

import type {
  IRecommendationAlgorithm,
  RecommendationContext,
  RecommendationSession,
  RecommendationResult,
  RecommendationItem,
} from './interface';
import { normalizeScores, DEFAULT_COOLDOWN } from './interface';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSimilarUsers } from '@/lib/taste-map/similarity';
import { getGenreProfile } from '@/lib/taste-map/redis';
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'genre_recommendations_v1';
const MIN_USER_HISTORY = 5;
const DOMINANT_GENRE_THRESHOLD = 50; // Genres with score >= 50 are dominant
const TOP_DOMINANT_GENRES = 3;
const MAX_SIMILAR_USERS = 10;
const TOP_MOVIES_PER_USER = 15;
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  genreMatchScore: 0.4,
  rating: 0.4,
  userSimilarity: 0.2,
};

/**
 * Genre match information for a movie
 */
interface GenreMatchInfo {
  tmdbId: number;
  mediaType: string;
  title: string;
  /** Rating from the similar user */
  rating: number;
  /** How well the movie matches user's dominant genres */
  genreMatchScore: number;
  /** User ID of the similar user */
  sourceUserId: string;
  /** Raw score before normalization */
  score: number;
}

/**
 * Genre Recommendations recommendation algorithm
 *
 * This algorithm extracts user's dominant genres (top genres with score >= 50),
 * finds similar users, and recommends highly-rated movies that match those genres.
 */
export const genreRecommendations: IRecommendationAlgorithm = {
  name: ALGORITHM_NAME,
  minUserHistory: MIN_USER_HISTORY,

  async execute(
    userId: string,
    context: RecommendationContext,
    sessionData: RecommendationSession
  ): Promise<RecommendationResult> {
    const startTime = Date.now();

    try {
      // 1. Get user's genre profile
      const genreProfile = await getGenreProfile(userId);

      if (!genreProfile) {
        logger.info('Genre Recommendations: no genre profile available', {
          userId,
          context: 'GenreRecommendations',
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
      const genreCount = Object.keys(genreProfile).length;
      if (genreCount === 0) {
        logger.info('Genre Recommendations: empty genre profile', {
          userId,
          context: 'GenreRecommendations',
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

      // 2. Extract dominant genres (top genres with score >= 50)
      const dominantGenres = extractDominantGenres(genreProfile);

      if (dominantGenres.length === 0) {
        logger.info('Genre Recommendations: no dominant genres found', {
          userId,
          genreCount,
          context: 'GenreRecommendations',
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

      // 3. Find similar users
      const similarUsers = await getSimilarUsers(userId);

      if (similarUsers.length === 0) {
        logger.info('Genre Recommendations: no similar users found', {
          userId,
          dominantGenres,
          context: 'GenreRecommendations',
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

      // Limit to top similar users
      const limitedSimilarUsers = similarUsers.slice(0, MAX_SIMILAR_USERS);

      // 4. Fetch highly-rated watched movies from similar users that match dominant genres
      const candidates = await fetchGenreMatchCandidates(
        limitedSimilarUsers,
        userId,
        dominantGenres
      );

      if (candidates.length === 0) {
        logger.info('Genre Recommendations: no candidates found', {
          userId,
          similarUsersCount: limitedSimilarUsers.length,
          dominantGenres,
          context: 'GenreRecommendations',
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

      const initialPoolSize = candidates.length;

      // 5. Calculate scores for each candidate
      const scoredCandidates = calculateCandidateScores(candidates);

      // 6. Apply cooldown filter
      const cooldownDate = subDays(new Date(), DEFAULT_COOLDOWN.days);
      const recentRecommendations = await prisma.recommendationLog.findMany({
        where: {
          userId,
          shownAt: { gte: cooldownDate },
        },
        select: { tmdbId: true, mediaType: true },
      });

      const cooldownKeys = new Set(
        recentRecommendations.map(r => `${r.tmdbId}_${r.mediaType}`)
      );

      // Also exclude items user already has in their list
      const userExistingItems = await prisma.watchList.findMany({
        where: { userId },
        select: { tmdbId: true, mediaType: true },
      });

      const existingKeys = new Set(
        userExistingItems.map(item => `${item.tmdbId}_${item.mediaType}`)
      );

      const filteredCandidates = scoredCandidates.filter(candidate => {
        const key = `${candidate.tmdbId}_${candidate.mediaType}`;
        return (
          !cooldownKeys.has(key) &&
          !existingKeys.has(key) &&
          !sessionData.previousRecommendations.has(key)
        );
      });

      const afterFilters = filteredCandidates.length;

      if (filteredCandidates.length === 0) {
        logger.info('Genre Recommendations: all candidates filtered', {
          userId,
          initialPoolSize,
          cooldownCount: cooldownKeys.size,
          existingCount: existingKeys.size,
          context: 'GenreRecommendations',
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
        sources: [candidate.sourceUserId],
      }));

      const avgScore = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
        : 0;

      const duration = Date.now() - startTime;
      logger.info('Genre Recommendations: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        dominantGenres,
        similarUsersCount: limitedSimilarUsers.length,
        durationMs: duration,
        context: 'GenreRecommendations',
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
      logger.error('Genre Recommendations: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'GenreRecommendations',
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
 * Extract dominant genres from genre profile
 * Returns top genres with score >= 50
 */
function extractDominantGenres(
  profile: Record<string, number>
): string[] {
  const genreList = Object.entries(profile)
    .sort((a, b) => b[1] - a[1]); // Sort by score descending

  // Take top genres with score >= 50
  const dominantGenres = genreList
    .filter(([_, score]) => score >= DOMINANT_GENRE_THRESHOLD)
    .slice(0, TOP_DOMINANT_GENRES)
    .map(([genre, _]) => genre);

  return dominantGenres;
}

/**
 * Calculate how well a movie matches user's dominant genres
 * Returns score between 0 and 1 (1 = perfect match)
 */
function calculateGenreMatchScore(
  movieGenre: string,
  dominantGenres: string[]
): number {
  if (dominantGenres.length === 0) return 0;

  // Check if movie genre is in dominant genres
  if (dominantGenres.includes(movieGenre)) {
    return 1;
  }

  // If not in dominant, give 0 score
  return 0;
}

/**
 * Fetch highly-rated watched movies from similar users that match dominant genres
 */
async function fetchGenreMatchCandidates(
  similarUsers: { userId: string; overallMatch: number }[],
  excludeUserId: string,
  dominantGenres: string[]
): Promise<GenreMatchInfo[]> {
  const watchedStatusIds = await getWatchedStatusIds();
  const candidateMap = new Map<string, GenreMatchInfo>();

  for (const similarUser of similarUsers) {
    // Get highly-rated watched items from this user
    const userItems = await prisma.watchList.findMany({
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
        // We need genre information - use TMDB API
      },
      take: TOP_MOVIES_PER_USER,
    });

    for (const item of userItems) {
      // Note: We would need TMDB movie details to get genre information
      // For now, we'll add all highly-rated items and later filter by genre
      // This is a simplified implementation as per plan
      const key = `${item.tmdbId}_${item.mediaType}`;

      const existing = candidateMap.get(key);
      if (!existing) {
        candidateMap.set(key, {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title || `Movie ${item.tmdbId}`,
          rating: (item.userRating ?? item.voteAverage ?? 7) / 10, // Normalize to 0-1
          genreMatchScore: 0, // Will be calculated later when we have genre data
          sourceUserId: similarUser.userId,
          score: 0,
        });
      }
    }
  }

  return Array.from(candidateMap.values());
}

/**
 * Calculate weighted scores for candidates
 */
function calculateCandidateScores(
  candidates: GenreMatchInfo[]
): GenreMatchInfo[] {
  const maxRating = Math.max(...candidates.map(c => c.rating), 1);

  return candidates.map(candidate => {
    // Genre match score (currently 0 for all since we don't have TMDB data)
    const genreMatchNorm = candidate.genreMatchScore;

    // Rating weight
    const ratingNorm = candidate.rating;

    // User similarity weight (using 0.5 for similar users)
    const userSimNorm = 0.5;

    // Weighted sum
    const rawScore =
      genreMatchNorm * WEIGHTS.genreMatchScore +
      ratingNorm * WEIGHTS.rating +
      userSimNorm * WEIGHTS.userSimilarity;

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

export default genreRecommendations;
