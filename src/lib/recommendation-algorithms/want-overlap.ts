/**
 * Want-to-Watch Overlap Algorithm (Pattern 2)
 * 
 * Recommends movies that similar users have added to their want list.
 * Focuses on recent wants (last 30 days) for freshness.
 * 
 * Score formula: (similarity * 0.4) + (wantFrequency * 0.4) + (genreMatch * 0.2)
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
import { getSimilarUsers, computeSimilarity } from '@/lib/taste-map/similarity';
import { getTasteMap } from '@/lib/taste-map/redis';
import { subDays } from 'date-fns';
import { fetchMediaDetails } from '@/lib/tmdb';

// Algorithm configuration
const ALGORITHM_NAME = 'want_overlap_v1';
const MIN_USER_HISTORY = 5; // Lower threshold for this pattern
const SIMILARITY_THRESHOLD = 0.6; // Lower threshold for want overlap
const MAX_SIMILAR_USERS = 15;
const WANT_RECENCY_DAYS = 30;
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  similarity: 0.4,
  wantFrequency: 0.4,
  genreMatch: 0.2,
};

/**
 * Want candidate from similar users' want lists
 */
interface WantCandidate {
  tmdbId: number;
  mediaType: string;
  title: string;
  /** Average similarity of users who want this */
  avgSimilarity: number;
  /** Count of similar users who want this */
  wantCount: number;
  /** User IDs who want this */
  sourceUserIds: string[];
  /** Genre IDs from TMDB */
  genreIds: number[];
}

/**
 * Want-to-Watch Overlap recommendation algorithm
 */
export const wantOverlap: IRecommendationAlgorithm = {
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
        logger.info('Want Overlap: cold start user', {
          userId,
          watchedCount,
          minRequired: MIN_USER_HISTORY,
          context: 'WantOverlap',
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

      // 2. Get user's genre preferences
      const userGenrePrefs = await getUserGenrePreferences(userId);

      // 3. Get similar users
      const similarUsers = await getOrComputeSimilarUsers(userId);

      if (similarUsers.length === 0) {
        logger.info('Want Overlap: no similar users found', {
          userId,
          context: 'WantOverlap',
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

      // 4. Fetch want list items from similar users
      const wantCandidates = await fetchWantCandidates(similarUsers, userId);

      if (wantCandidates.length === 0) {
        logger.info('Want Overlap: no want candidates', {
          userId,
          similarUsersCount: similarUsers.length,
          context: 'WantOverlap',
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

      const initialPoolSize = wantCandidates.length;

      // 5. Filter out movies user already has in their lists
      const userExistingItems = await prisma.watchList.findMany({
        where: { userId },
        select: { tmdbId: true, mediaType: true },
      });

      // Also exclude cooldown items
      const cooldownDate = subDays(new Date(), DEFAULT_COOLDOWN.days);
      const recentRecommendations = await prisma.recommendationLog.findMany({
        where: {
          userId,
          shownAt: { gte: cooldownDate },
        },
        select: { tmdbId: true, mediaType: true },
      });

      // Build excluded keys from existing items and cooldown
      const excludedKeys = new Set<string>();
      for (const item of userExistingItems) {
        excludedKeys.add(`${item.tmdbId}_${item.mediaType}`);
      }
      for (const r of recentRecommendations) {
        excludedKeys.add(`${r.tmdbId}_${r.mediaType}`);
      }

      const filteredCandidates = wantCandidates.filter(candidate => {
        const key = `${candidate.tmdbId}_${candidate.mediaType}`;
        return !excludedKeys.has(key) && !sessionData.previousRecommendations.has(key);
      });

      const afterFilters = filteredCandidates.length;

      if (filteredCandidates.length === 0) {
        logger.info('Want Overlap: all candidates filtered', {
          userId,
          initialPoolSize,
          excludedCount: excludedKeys.size,
          context: 'WantOverlap',
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

      // 6. Calculate scores with genre matching
      const scoredCandidates = await calculateCandidateScores(
        filteredCandidates,
        similarUsers,
        userGenrePrefs
      );

      // 7. Normalize scores to 0-100
      const normalizedCandidates = normalizeScores(scoredCandidates);

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
        sources: candidate.sourceUserIds.slice(0, 3),
      }));

      const avgScore = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
        : 0;

      const duration = Date.now() - startTime;
      logger.info('Want Overlap: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        durationMs: duration,
        context: 'WantOverlap',
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
      logger.error('Want Overlap: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'WantOverlap',
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
 * Get user's top preferred genre IDs
 */
async function getUserGenrePreferences(userId: string): Promise<Set<number>> {
  const tasteMap = await getTasteMap(userId);
  
  if (!tasteMap?.genreProfile) {
    return new Set();
  }

  // Get top 5 genres from profile
  const genres = Object.entries(tasteMap.genreProfile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name]) => getGenreIdByName(name));

  return new Set(genres.filter((id): id is number => id !== null));
}

/**
 * Map genre name to TMDB genre ID
 */
function getGenreIdByName(name: string): number | null {
  const genreMap: Record<string, number> = {
    'Action': 28,
    'Adventure': 12,
    'Animation': 16,
    'Comedy': 35,
    'Crime': 80,
    'Documentary': 99,
    'Drama': 18,
    'Family': 10751,
    'Fantasy': 14,
    'History': 36,
    'Horror': 27,
    'Music': 10402,
    'Mystery': 9648,
    'Romance': 10749,
    'Science Fiction': 878,
    'TV Movie': 10770,
    'Thriller': 53,
    'War': 10752,
    'Western': 37,
    // TV genres
    'Action & Adventure': 10759,
    'Kids': 10762,
    'News': 10763,
    'Reality': 10764,
    'Sci-Fi & Fantasy': 10765,
    'Soap': 10766,
    'Talk': 10767,
    'War & Politics': 10768,
  };

  return genreMap[name] ?? null;
}

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
 * Fetch recent want list items from similar users
 */
async function fetchWantCandidates(
  similarUsers: { userId: string; overallMatch: number }[],
  excludeUserId: string
): Promise<WantCandidate[]> {
  const wantStatusId = await getWantStatusId();
  if (!wantStatusId) {
    return [];
  }

  const recentDate = subDays(new Date(), WANT_RECENCY_DAYS);
  const candidateMap = new Map<string, WantCandidate>();
  const similarUserIds = similarUsers.map(u => u.userId);
  const similarityMap = new Map(similarUsers.map(u => [u.userId, u.overallMatch]));

  // Fetch want items from similar users
  const wantItems = await prisma.watchList.findMany({
    where: {
      userId: { in: similarUserIds },
      statusId: wantStatusId,
      addedAt: { gte: recentDate },
    },
    select: {
      tmdbId: true,
      mediaType: true,
      title: true,
      userId: true,
    },
  });

  for (const item of wantItems) {
    const key = `${item.tmdbId}_${item.mediaType}`;
    const similarity = similarityMap.get(item.userId) ?? 0;
    
    const existing = candidateMap.get(key);
    if (existing) {
      // Update existing entry
      existing.wantCount += 1;
      existing.sourceUserIds.push(item.userId);
      // Update average similarity
      const totalSimilarity = existing.avgSimilarity * (existing.wantCount - 1) + similarity;
      existing.avgSimilarity = totalSimilarity / existing.wantCount;
    } else {
      // Create new entry
      candidateMap.set(key, {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title || `Movie ${item.tmdbId}`,
        avgSimilarity: similarity,
        wantCount: 1,
        sourceUserIds: [item.userId],
        genreIds: [], // Will be fetched later if needed
      });
    }
  }

  return Array.from(candidateMap.values());
}

/**
 * Calculate weighted scores for candidates
 */
async function calculateCandidateScores(
  candidates: WantCandidate[],
  similarUsers: { userId: string; overallMatch: number }[],
  userGenrePrefs: Set<number>
): Promise<(WantCandidate & { score: number })[]> {
  const maxWantCount = Math.max(...candidates.map(c => c.wantCount), 1);

  return candidates.map(candidate => {
    // Normalize components
    const similarityNorm = candidate.avgSimilarity; // Already 0-1
    const wantFrequencyNorm = candidate.wantCount / maxWantCount; // 0-1 relative
    
    // Genre match: check if candidate genres overlap with user preferences
    let genreMatchNorm = 0.5; // Default neutral if we can't determine
    if (candidate.genreIds.length > 0 && userGenrePrefs.size > 0) {
      const matchingGenres = candidate.genreIds.filter(id => userGenrePrefs.has(id)).length;
      genreMatchNorm = matchingGenres / Math.min(candidate.genreIds.length, 3);
    }

    // Weighted sum
    const rawScore =
      similarityNorm * WEIGHTS.similarity +
      wantFrequencyNorm * WEIGHTS.wantFrequency +
      genreMatchNorm * WEIGHTS.genreMatch;

    return {
      ...candidate,
      score: rawScore,
    };
  });
}

/**
 * Get status ID for watched content
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
 * Get status ID for want-to-watch
 */
async function getWantStatusId(): Promise<number | null> {
  const status = await prisma.movieStatus.findFirst({
    where: { name: 'Хочу посмотреть' },
    select: { id: true },
  });
  
  return status?.id ?? null;
}

export default wantOverlap;
