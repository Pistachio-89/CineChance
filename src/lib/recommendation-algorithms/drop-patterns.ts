/**
 * Drop Patterns Algorithm (Pattern 3)
 * 
 * Recommends movies while avoiding content similar users dropped.
 * Uses negative feedback to prevent frustrating recommendations.
 * 
 * Strategy: Penalize movies that similar users dropped, but don't eliminate
 * them entirely. The penalty is capped at 70% to preserve diversity.
 * 
 * Score formula: baseScore * (1 - dropPenalty)
 * Where dropPenalty = min(dropFrequency / totalSimilarUsers * 0.7, 0.7)
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
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'drop_patterns_v1';
const MIN_USER_HISTORY = 8;
const SIMILARITY_THRESHOLD = 0.65; // Slightly lower for broader coverage
const MAX_SIMILAR_USERS = 15;
const DROP_RECENCY_DAYS = 90; // Only consider drops from last 90 days
const MAX_DROP_PENALTY = 0.7; // Max 70% penalty
const MAX_RECOMMENDATIONS = 12;

/**
 * Candidate with drop penalty information
 */
interface DropCandidate {
  tmdbId: number;
  mediaType: string;
  title: string;
  /** Base score from user's preference or neutral */
  baseScore: number;
  /** Count of similar users who dropped this */
  dropFrequency: number;
  /** Total similar users considered */
  totalSimilarUsers: number;
  /** Calculated penalty (0-0.7) */
  dropPenalty: number;
  /** Final adjusted score */
  score: number;
}

/**
 * Drop Patterns recommendation algorithm
 * 
 * This algorithm is defensive - it reduces likelihood of showing movies
 * that caused similar users to abandon. Should be combined with other
 * patterns in an ensemble.
 */
export const dropPatterns: IRecommendationAlgorithm = {
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
        logger.info('Drop Patterns: cold start user', {
          userId,
          watchedCount,
          minRequired: MIN_USER_HISTORY,
          context: 'DropPatterns',
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

      // 2. Get user's dropped movies to understand drop patterns
      const droppedStatusId = await getDroppedStatusId();
      const userDroppedItems = droppedStatusId
        ? await prisma.watchList.findMany({
            where: {
              userId,
              statusId: droppedStatusId,
            },
            select: { tmdbId: true, mediaType: true },
          })
        : [];

      const userDroppedKeys = new Set(
        userDroppedItems.map(item => `${item.tmdbId}_${item.mediaType}`)
      );

      // 3. Get similar users (slightly lower threshold)
      const similarUsers = await getOrComputeSimilarUsers(userId);

      if (similarUsers.length === 0) {
        logger.info('Drop Patterns: no similar users found', {
          userId,
          context: 'DropPatterns',
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

      // 4. Get dropped movies from similar users (last 90 days)
      const similarUserIds = similarUsers.map(u => u.userId);
      const dropDate = subDays(new Date(), DROP_RECENCY_DAYS);

      const similarUserDrops = droppedStatusId
        ? await prisma.watchList.findMany({
            where: {
              userId: { in: similarUserIds },
              statusId: droppedStatusId,
              addedAt: { gte: dropDate },
            },
            select: {
              tmdbId: true,
              mediaType: true,
              userId: true,
            },
          })
        : [];

      // Build drop frequency map: how many similar users dropped each movie
      const dropFrequencyMap = new Map<string, number>();
      for (const drop of similarUserDrops) {
        const key = `${drop.tmdbId}_${drop.mediaType}`;
        const current = dropFrequencyMap.get(key) || 0;
        dropFrequencyMap.set(key, current + 1);
      }

      // 5. Build candidate pool from user's own lists (watched/want, not dropped)
      const wantStatusId = await getWantStatusId();
      const candidateStatusIds = [...watchedStatusIds];
      if (wantStatusId) candidateStatusIds.push(wantStatusId);

      const userCandidates = await prisma.watchList.findMany({
        where: {
          userId,
          statusId: { in: candidateStatusIds },
        },
        select: {
          tmdbId: true,
          mediaType: true,
          title: true,
          userRating: true,
          voteAverage: true,
        },
      });

      // Filter out user's own dropped items
      const filteredCandidates = userCandidates.filter(
        candidate => !userDroppedKeys.has(`${candidate.tmdbId}_${candidate.mediaType}`)
      );

      if (filteredCandidates.length === 0) {
        logger.info('Drop Patterns: no candidates after filtering', {
          userId,
          context: 'DropPatterns',
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

      const initialPoolSize = filteredCandidates.length;

      // 6. Calculate drop penalty for each candidate
      const scoredCandidates: DropCandidate[] = filteredCandidates.map(candidate => {
        const key = `${candidate.tmdbId}_${candidate.mediaType}`;
        const dropFreq = dropFrequencyMap.get(key) || 0;
        
        // Calculate penalty: capped at 70%
        const penaltyRatio = dropFreq / similarUsers.length;
        const dropPenalty = Math.min(penaltyRatio * MAX_DROP_PENALTY, MAX_DROP_PENALTY);
        
        // Base score from user's rating or neutral 0.5
        const baseScore = candidate.userRating
          ? candidate.userRating / 10
          : candidate.voteAverage
          ? candidate.voteAverage / 20 // Normalize vote average (0-10) to ~0-0.5
          : 0.5;
        
        // Adjusted score after penalty
        const adjustedScore = baseScore * (1 - dropPenalty);

        return {
          tmdbId: candidate.tmdbId,
          mediaType: candidate.mediaType,
          title: candidate.title || `Movie ${candidate.tmdbId}`,
          baseScore,
          dropFrequency: dropFreq,
          totalSimilarUsers: similarUsers.length,
          dropPenalty,
          score: adjustedScore,
        };
      });

      // 7. Apply cooldown filter
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

      const afterCooldownCandidates = scoredCandidates.filter(candidate => {
        const key = `${candidate.tmdbId}_${candidate.mediaType}`;
        return !cooldownKeys.has(key) && !sessionData.previousRecommendations.has(key);
      });

      const afterFilters = afterCooldownCandidates.length;

      if (afterCooldownCandidates.length === 0) {
        logger.info('Drop Patterns: all candidates filtered by cooldown', {
          userId,
          initialPoolSize,
          cooldownCount: cooldownKeys.size,
          context: 'DropPatterns',
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

      // 8. Normalize scores to 0-100
      const normalizedCandidates = normalizeScores(afterCooldownCandidates);

      // 9. Sort by score descending and take top N
      const topCandidates = normalizedCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      // 10. Build final recommendations
      const recommendations: RecommendationItem[] = topCandidates.map(candidate => ({
        tmdbId: candidate.tmdbId,
        mediaType: candidate.mediaType,
        title: candidate.title,
        score: candidate.score,
        algorithm: ALGORITHM_NAME,
      }));

      const avgScore = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
        : 0;

      const duration = Date.now() - startTime;
      logger.info('Drop Patterns: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        similarUsersCount: similarUsers.length,
        totalDropsFromSimilar: similarUserDrops.length,
        durationMs: duration,
        context: 'DropPatterns',
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
      logger.error('Drop Patterns: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'DropPatterns',
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
    // Filter by lower threshold for drop patterns
    const filtered = cached.filter(u => u.overallMatch >= SIMILARITY_THRESHOLD);
    return filtered.slice(0, MAX_SIMILAR_USERS);
  }

  // If no cache, compute similarity for sample of users
  const allUserIds = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true },
    take: 50, // Sample for performance
  });

  const candidateIds = allUserIds.map(u => u.id);
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
 * Get status ID for dropped content
 */
async function getDroppedStatusId(): Promise<number | null> {
  const status = await prisma.movieStatus.findFirst({
    where: { name: 'Брошено' },
    select: { id: true },
  });
  
  return status?.id ?? null;
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

export default dropPatterns;
