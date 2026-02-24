/**
 * Type Twins Algorithm (Pattern 4)
 * 
 * Recommends movies based on content type preference matching.
 * Matches users by their content type distribution (movies, TV, anime, cartoons)
 * and prioritizes candidates from users with similar type preferences.
 * 
 * Type similarity: 1 - (sum of abs(typePct differences) / 2)
 * Score formula: (typeSimilarity * 0.5) + (twinRating * 0.3) + (dominantTypeMatch * 0.2)
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
import { subDays } from 'date-fns';

// Algorithm configuration
const ALGORITHM_NAME = 'type_twins_v1';
const MIN_USER_HISTORY = 3; // Low threshold - can work with small history
const TYPE_SIMILARITY_THRESHOLD = 0.7; // Strong type match
const MAX_TYPE_TWINS = 10;
const SAMPLE_ACTIVE_USERS = 100; // Sample for type twin discovery
const MAX_RECOMMENDATIONS = 12;

// Score weights
const WEIGHTS = {
  typeSimilarity: 0.5,
  twinRating: 0.3,
  dominantTypeMatch: 0.2,
};

// Supported media types
const MEDIA_TYPES = ['movie', 'tv', 'anime', 'cartoon'] as const;
type MediaType = typeof MEDIA_TYPES[number];

/**
 * User's content type distribution profile
 */
interface TypeProfile {
  movie: number;
  tv: number;
  anime: number;
  cartoon: number;
}

/**
 * Candidate with type matching information
 */
interface TypeCandidate {
  tmdbId: number;
  mediaType: string;
  title: string;
  /** Rating from the type twin */
  twinRating: number;
  /** Type similarity of the twin who contributed this */
  typeSimilarity: number;
  /** Whether candidate matches user's dominant type */
  matchesDominantType: boolean;
  /** User ID of the twin who contributed this */
  sourceUserId: string;
  /** Raw score before normalization */
  score: number;
}

/**
 * Type Twins recommendation algorithm
 * 
 * This algorithm matches users by their content type preferences,
 * making it effective for users with strong preferences (e.g., anime fans)
 * or those exploring specific content types.
 */
export const typeTwins: IRecommendationAlgorithm = {
  name: ALGORITHM_NAME,
  minUserHistory: MIN_USER_HISTORY,

  async execute(
    userId: string,
    context: RecommendationContext,
    sessionData: RecommendationSession
  ): Promise<RecommendationResult> {
    const startTime = Date.now();

    try {
      // 1. Calculate user's content type distribution
      const userTypeProfile = await calculateUserTypeProfile(userId);

      // 2. Determine dominant type and if user has strong preference
      const dominantType = getDominantType(userTypeProfile);
      const hasStrongPreference = userTypeProfile[dominantType] >= 50;

      // 3. Check minimum history
      const totalItems = Object.values(userTypeProfile).reduce((sum, v) => sum + v, 0);
      
      if (totalItems < MIN_USER_HISTORY) {
        logger.info('Type Twins: insufficient history', {
          userId,
          totalItems,
          minRequired: MIN_USER_HISTORY,
          context: 'TypeTwins',
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

      // 4. Find type twins
      const typeTwins = await findTypeTwins(userId, userTypeProfile);

      if (typeTwins.length === 0) {
        logger.info('Type Twins: no type twins found', {
          userId,
          dominantType,
          hasStrongPreference,
          context: 'TypeTwins',
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

      // 5. Fetch highly-rated watched movies from type twins
      const candidates = await fetchTypeTwinCandidates(
        typeTwins,
        userId,
        dominantType,
        hasStrongPreference
      );

      if (candidates.length === 0) {
        logger.info('Type Twins: no candidates from type twins', {
          userId,
          typeTwinsCount: typeTwins.length,
          context: 'TypeTwins',
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

      // 6. Calculate scores for each candidate
      const scoredCandidates = calculateCandidateScores(
        candidates,
        dominantType,
        hasStrongPreference
      );

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
        logger.info('Type Twins: all candidates filtered', {
          userId,
          initialPoolSize,
          cooldownCount: cooldownKeys.size,
          existingCount: existingKeys.size,
          context: 'TypeTwins',
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
      const normalizedCandidates = normalizeScores(filteredCandidates);

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
        sources: [candidate.sourceUserId],
      }));

      const avgScore = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
        : 0;

      const duration = Date.now() - startTime;
      logger.info('Type Twins: recommendations generated', {
        userId,
        recommendationsCount: recommendations.length,
        initialPoolSize,
        afterFilters,
        avgScore: avgScore.toFixed(1),
        dominantType,
        hasStrongPreference,
        typeTwinsCount: typeTwins.length,
        durationMs: duration,
        context: 'TypeTwins',
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
      logger.error('Type Twins: execution error', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        context: 'TypeTwins',
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
 * Calculate user's content type distribution from watch history
 * Returns percentages (0-100) for each type
 */
async function calculateUserTypeProfile(userId: string): Promise<TypeProfile> {
  const watchedStatusIds = await getWatchedStatusIds();

  // Use groupBy for efficient counting
  const typeCounts = await prisma.watchList.groupBy({
    by: ['mediaType'],
    where: {
      userId,
      statusId: { in: watchedStatusIds },
    },
    _count: {
      mediaType: true,
    },
  });

  // Calculate total
  const total = typeCounts.reduce((sum, item) => sum + item._count.mediaType, 0);

  // Build profile with percentages
  const profile: TypeProfile = {
    movie: 0,
    tv: 0,
    anime: 0,
    cartoon: 0,
  };

  if (total > 0) {
    for (const item of typeCounts) {
      const mediaType = item.mediaType as MediaType;
      if (mediaType in profile) {
        profile[mediaType] = Math.round((item._count.mediaType / total) * 100);
      }
    }
  }

  return profile;
}

/**
 * Get the dominant content type from a profile
 */
function getDominantType(profile: TypeProfile): MediaType {
  let dominantType: MediaType = 'movie';
  let maxPercentage = 0;

  for (const type of MEDIA_TYPES) {
    if (profile[type] > maxPercentage) {
      maxPercentage = profile[type];
      dominantType = type;
    }
  }

  return dominantType;
}

/**
 * Calculate type similarity between two profiles
 * Uses a Jaccard-like similarity: 1 - (sum of abs(differences) / 2)
 * Returns value between 0 and 1 (1 = identical profiles)
 */
function calculateTypeSimilarity(profileA: TypeProfile, profileB: TypeProfile): number {
  let totalDifference = 0;

  for (const type of MEDIA_TYPES) {
    totalDifference += Math.abs(profileA[type] - profileB[type]);
  }

  // Max possible difference is 200 (100% + 100%), normalize to 0-1
  // Each percentage difference contributes, sum divided by 200 gives dissimilarity
  return 1 - (totalDifference / 200);
}

/**
 * Find users with similar content type preferences
 */
async function findTypeTwins(
  userId: string,
  userTypeProfile: TypeProfile
): Promise<{ userId: string; typeSimilarity: number; profile: TypeProfile }[]> {
  // Get sample of active users (recent activity)
  const recentDate = subDays(new Date(), 30);
  const activeUsers = await prisma.watchList.findMany({
    where: {
      addedAt: { gte: recentDate },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: SAMPLE_ACTIVE_USERS,
  });

  const candidateUserIds = activeUsers
    .map(u => u.userId)
    .filter(id => id !== userId);

  const typeTwins: { userId: string; typeSimilarity: number; profile: TypeProfile }[] = [];

  // Calculate type profile for each candidate and find matches
  for (const candidateId of candidateUserIds) {
    try {
      const candidateProfile = await calculateUserTypeProfile(candidateId);
      const similarity = calculateTypeSimilarity(userTypeProfile, candidateProfile);

      if (similarity >= TYPE_SIMILARITY_THRESHOLD) {
        typeTwins.push({
          userId: candidateId,
          typeSimilarity: similarity,
          profile: candidateProfile,
        });
      }
    } catch {
      // Skip users with errors
    }
  }

  // Sort by similarity (highest first) and limit
  return typeTwins
    .sort((a, b) => b.typeSimilarity - a.typeSimilarity)
    .slice(0, MAX_TYPE_TWINS);
}

/**
 * Fetch highly-rated watched movies from type twins
 */
async function fetchTypeTwinCandidates(
  typeTwins: { userId: string; typeSimilarity: number; profile: TypeProfile }[],
  excludeUserId: string,
  dominantType: MediaType,
  hasStrongPreference: boolean
): Promise<TypeCandidate[]> {
  const watchedStatusIds = await getWatchedStatusIds();
  const candidateMap = new Map<string, TypeCandidate>();

  for (const twin of typeTwins) {
    // Get highly-rated watched items from this twin
    const twinItems = await prisma.watchList.findMany({
      where: {
        userId: twin.userId,
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
      take: 15, // Top items per twin
    });

    for (const item of twinItems) {
      const key = `${item.tmdbId}_${item.mediaType}`;
      
      // Skip if we already have this item with higher similarity
      const existing = candidateMap.get(key);
      if (existing && existing.typeSimilarity >= twin.typeSimilarity) {
        continue;
      }

      const candidateMediaType = item.mediaType as MediaType;
      const matchesDominantType = hasStrongPreference && candidateMediaType === dominantType;

      candidateMap.set(key, {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title || `Movie ${item.tmdbId}`,
        twinRating: (item.userRating ?? item.voteAverage ?? 7) / 10, // Normalize to 0-1
        typeSimilarity: twin.typeSimilarity,
        matchesDominantType,
        sourceUserId: twin.userId,
        score: 0, // Will be calculated later
      });
    }
  }

  return Array.from(candidateMap.values());
}

/**
 * Calculate weighted scores for candidates
 */
function calculateCandidateScores(
  candidates: TypeCandidate[],
  dominantType: MediaType,
  hasStrongPreference: boolean
): TypeCandidate[] {
  return candidates.map(candidate => {
    // Type similarity weight
    const typeSimNorm = candidate.typeSimilarity; // Already 0-1
    
    // Twin's rating weight
    const ratingNorm = candidate.twinRating; // Already 0-1
    
    // Dominant type match bonus
    const dominantMatchNorm = candidate.matchesDominantType ? 1 : 0.5;

    // Weighted sum
    const rawScore =
      typeSimNorm * WEIGHTS.typeSimilarity +
      ratingNorm * WEIGHTS.twinRating +
      dominantMatchNorm * WEIGHTS.dominantTypeMatch;

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

export default typeTwins;
