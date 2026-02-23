/**
 * Pattern-Based Recommendations API
 * 
 * GET /api/recommendations/patterns
 * 
 * Combines multiple recommendation algorithms to generate personalized suggestions.
 * Falls back to TMDB popular/trending for cold start users (<10 watched).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { recommendationAlgorithms } from '@/lib/recommendation-algorithms';
import type {
  RecommendationContext,
  RecommendationSession,
  RecommendationItem,
} from '@/lib/recommendation-algorithms';
import { fetchTrendingMovies, fetchPopularMovies } from '@/lib/tmdb';
import { subDays } from 'date-fns';
import { randomUUID } from 'crypto';
import { getRedis } from '@/lib/redis';

// Constants
const COLD_START_THRESHOLD = 10; // Users with <10 watched get fallback
const HEAVY_USER_THRESHOLD = 500; // Users with 500+ watched get sampled
const HEAVY_USER_SAMPLE_SIZE = 200; // Sample most recent N for heavy users
const MAX_RECOMMENDATIONS = 12;
const RECOMMENDATION_COOLDOWN_DAYS = 7;
const CACHE_TTL_SECONDS = 900; // 15 minutes

/**
 * Generate cache key for recommendations
 */
function generateCacheKey(userId: string): string {
  return `recs:${userId}:patterns:v1`;
}

/**
 * Helper to generate session ID and initial session data
 */
function createSessionData(): RecommendationSession {
  const now = new Date();
  
  return {
    sessionId: randomUUID(),
    startTime: now,
    previousRecommendations: new Set<string>(),
    temporalContext: {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isFirstSessionOfDay: true,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
    },
    mlFeatures: {
      similarityScore: 0,
      noveltyScore: 0.5,
      diversityScore: 0.5,
      predictedAcceptanceProbability: 0.5,
    },
  };
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
 * Get cold start fallback recommendations from TMDB
 */
async function getColdStartFallback(): Promise<RecommendationItem[]> {
  try {
    // Try trending first, fall back to popular
    const trending = await fetchTrendingMovies('week');
    
    if (trending && trending.length > 0) {
      return trending.slice(0, MAX_RECOMMENDATIONS).map((item, index: number) => ({
        tmdbId: item.id,
        mediaType: item.media_type || 'movie',
        title: item.title || item.name || `Movie ${item.id}`,
        score: 100 - (index * 5), // Simple descending score
        algorithm: 'tmdb_trending_fallback',
        sources: [],
      }));
    }

    // Fallback to popular
    const popular = await fetchPopularMovies(1);
    
    if (popular && popular.length > 0) {
      return popular.slice(0, MAX_RECOMMENDATIONS).map((item, index: number) => ({
        tmdbId: item.id,
        mediaType: item.media_type || 'movie',
        title: item.title || item.name || `Movie ${item.id}`,
        score: 100 - (index * 5),
        algorithm: 'tmdb_popular_fallback',
        sources: [],
      }));
    }

    return [];
  } catch (error) {
    logger.error('Cold start fallback failed', {
      error: error instanceof Error ? error.message : String(error),
      context: 'PatternsAPI',
    });
    return [];
  }
}

/**
 * Deduplicate recommendations by tmdbId+mediaType, keeping highest score
 */
function deduplicateRecommendations(
  allRecommendations: RecommendationItem[]
): RecommendationItem[] {
  const byKey = new Map<string, RecommendationItem>();

  for (const rec of allRecommendations) {
    const key = `${rec.tmdbId}_${rec.mediaType}`;
    const existing = byKey.get(key);
    
    if (!existing || rec.score > existing.score) {
      byKey.set(key, rec);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Calculate confidence score for recommendations
 * 
 * Algorithm:
 * - Base: 50 + (algorithmCount * 5), max 90
 * - Similar users: +10 if 5+ found
 * - Variance: -20 if high variance (std dev > 20)
 * - Cold start: -30 (lower confidence)
 * - Heavy user sampling: -10 (sampling = less data)
 */
function calculateConfidence(
  algorithmCount: number,
  similarUsersFound: number,
  isColdStart: boolean,
  isHeavyUser: boolean,
  recommendations: RecommendationItem[]
): { value: number; factors: { algorithmCount: number; similarUsersFound: number; scoreVariance: number; isColdStart: boolean; isHeavyUser: boolean } } {
  // Calculate score variance
  let scoreVariance = 0;
  if (recommendations.length > 1) {
    const scores = recommendations.map(r => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
    scoreVariance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Base confidence: 50 + (algorithmCount * 5), max 90
  let confidence = 50 + (algorithmCount * 5);
  confidence = Math.min(confidence, 90);

  // Similar users: +10 if 5+ found
  if (similarUsersFound >= 5) {
    confidence += 10;
  }

  // High variance: -20 if std dev > 20
  if (scoreVariance > 20) {
    confidence -= 20;
  }

  // Cold start: -30 (lower confidence)
  if (isColdStart) {
    confidence -= 30;
  }

  // Heavy user sampling: -10 (sampling = less data)
  if (isHeavyUser) {
    confidence -= 10;
  }

  // Clamp to 0-100 range
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    value: Math.round(confidence),
    factors: {
      algorithmCount,
      similarUsersFound,
      scoreVariance: Math.round(scoreVariance * 10) / 10,
      isColdStart,
      isHeavyUser,
    },
  };
}

/**
 * Apply cooldown filter to recommendations
 */
async function applyCooldownFilter(
  recommendations: RecommendationItem[],
  userId: string
): Promise<RecommendationItem[]> {
  const cooldownDate = subDays(new Date(), RECOMMENDATION_COOLDOWN_DAYS);
  
  const recentRecommendations = await prisma.recommendationLog.findMany({
    where: {
      userId,
      shownAt: { gte: cooldownDate },
    },
    select: { tmdbId: true, mediaType: true },
  });

  const excludedKeys = new Set<string>();
  for (const r of recentRecommendations) {
    excludedKeys.add(`${r.tmdbId}_${r.mediaType}`);
  }

  return recommendations.filter(rec => {
    const key = `${rec.tmdbId}_${rec.mediaType}`;
    return !excludedKeys.has(key);
  });
}

/**
 * Log recommendations to RecommendationLog
 * Returns array of created log IDs
 */
async function logRecommendations(
  userId: string,
  recommendations: RecommendationItem[]
): Promise<string[]> {
  try {
    const logPromises = recommendations.map(rec => 
      prisma.recommendationLog.create({
        data: {
          userId,
          tmdbId: rec.tmdbId,
          mediaType: rec.mediaType,
          algorithm: rec.algorithm,
          score: rec.score,
          action: 'shown',
          context: {
            sources: rec.sources,
            source: 'patterns_api',
          } as any,
        },
      })
    );

    const createdLogs = await Promise.all(logPromises);
    return createdLogs.map(log => log.id);
  } catch (error) {
    logger.error('Failed to log recommendations', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      context: 'PatternsAPI',
    });
    return [];
  }
}

/**
 * GET /api/recommendations/patterns
 * 
 * Returns pattern-based recommendations combining multiple algorithms.
 * Falls back to TMDB trending/popular for cold start users.
 */
export async function GET(req: Request) {
  const startTime = Date.now();
  const requestId = randomUUID();
  const endpoint = 'GET /api/recommendations/patterns';

  // Check authentication FIRST
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Apply rate limiting with userId
  const { success } = await rateLimit(req, '/api/recommendations/patterns', userId);
  if (!success) {
    return NextResponse.json(
      { success: false, message: 'Too many requests' },
      { status: 429 }
    );
  }

  // Check Redis cache first
  const redis = getRedis();
  const cacheKey = generateCacheKey(userId);
  const cacheHit = false;

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        logger.info('Patterns API: cache hit', {
          requestId,
          userId,
          context: 'PatternsAPI',
        });

        return NextResponse.json({
          ...cachedData,
          meta: {
            ...cachedData.meta,
            cacheHit: true,
            cacheKey,
          },
        }, {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
          },
        });
      }
      logger.info('Patterns API: cache miss', {
        requestId,
        userId,
        context: 'PatternsAPI',
      });
    } catch (error) {
      logger.error('Patterns API: cache lookup failed', {
        requestId,
        userId,
        error: error instanceof Error ? error.message : String(error),
        context: 'PatternsAPI',
      });
    }
  }

  try {
    // Check if user is cold start
    const watchedStatusIds = await getWatchedStatusIds();
    const watchedCount = await prisma.watchList.count({
      where: {
        userId,
        statusId: { in: watchedStatusIds },
      },
    });

    const isColdStart = watchedCount < COLD_START_THRESHOLD;
    const isHeavyUser = watchedCount >= HEAVY_USER_THRESHOLD;

    logger.info('Patterns API: request started', {
      requestId,
      userId,
      watchedCount,
      isColdStart,
      isHeavyUser,
      context: 'PatternsAPI',
    });

    let recommendations: RecommendationItem[];
    const algorithmTimeouts: string[] = [];
    const algorithmsStatus: Record<string, { success: boolean; error?: string }> = {};
    let allRecommendations: RecommendationItem[] = [];

    if (isColdStart) {
      // Cold start: use TMDB fallback
      recommendations = await getColdStartFallback();
      
      logger.info('Patterns API: using cold start fallback', {
        requestId,
        userId,
        recommendationsCount: recommendations.length,
        context: 'PatternsAPI',
      });
    } else {
      // Run all algorithms and collect results
      const context: RecommendationContext = {
        source: 'recommendations_page',
        position: 0,
        candidatesCount: 0,
      };

      const sessionData = createSessionData();

      // For heavy users, pass sampling info to algorithms
      if (isHeavyUser) {
        sessionData.sampleSize = HEAVY_USER_SAMPLE_SIZE;
        sessionData.isHeavyUser = true;
      }

      allRecommendations = [];
      const ALGORITHM_TIMEOUT_MS = 3000; // 3 seconds per algorithm

      // Track per-algorithm success/failure status (reuse outer variable)

      for (const algorithm of recommendationAlgorithms) {
        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            algorithmTimeouts.push(algorithm.name);
            logger.warn('Patterns API: algorithm timed out', {
              requestId,
              algorithm: algorithm.name,
              timeoutMs: ALGORITHM_TIMEOUT_MS,
              context: 'PatternsAPI',
            });
          }, ALGORITHM_TIMEOUT_MS);

          const result = await algorithm.execute(userId, context, sessionData);
          clearTimeout(timeoutId);
          
          // Track algorithm success
          algorithmsStatus[algorithm.name] = { success: true };

          // Add recommendations to pool
          allRecommendations.push(...result.recommendations);

          // Update session with previous recommendations
          for (const rec of result.recommendations) {
            sessionData.previousRecommendations.add(`${rec.tmdbId}_${rec.mediaType}`);
          }

          logger.info('Patterns API: algorithm executed', {
            requestId,
            algorithm: algorithm.name,
            recommendationsCount: result.recommendations.length,
            metrics: result.metrics,
            context: 'PatternsAPI',
          });
        } catch (error) {
          // Check if it was a timeout
          if (error instanceof Error && error.name === 'AbortError') {
            algorithmTimeouts.push(algorithm.name);
            algorithmsStatus[algorithm.name] = { 
              success: false, 
              error: 'timeout' 
            };
            logger.warn('Patterns API: algorithm aborted due to timeout', {
              requestId,
              algorithm: algorithm.name,
              timeoutMs: ALGORITHM_TIMEOUT_MS,
              context: 'PatternsAPI',
            });
          } else {
            const errorMessage = error instanceof Error ? error.message : String(error);
            algorithmsStatus[algorithm.name] = { 
              success: false, 
              error: errorMessage 
            };
            logger.error('Patterns API: algorithm failed', {
              requestId,
              algorithm: algorithm.name,
              error: errorMessage,
              context: 'PatternsAPI',
            });
          }
          // Continue with other algorithms
        }
      }

      // Deduplicate by tmdbId+mediaType
      const deduplicated = deduplicateRecommendations(allRecommendations);

      // Apply final cooldown filter
      const filtered = await applyCooldownFilter(deduplicated, userId);

      // Sort by score and take top N
      recommendations = filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      logger.info('Patterns API: algorithms combined', {
        requestId,
        totalCandidates: allRecommendations.length,
        afterDedup: deduplicated.length,
        afterCooldown: filtered.length,
        finalCount: recommendations.length,
        context: 'PatternsAPI',
      });
    }

    // Log recommendations and capture the log IDs
    let logIds: string[] = [];
    if (recommendations.length > 0) {
      logIds = await logRecommendations(userId, recommendations);
    }

    // Calculate confidence score
    const successfulAlgorithms = Object.values(algorithmsStatus).filter(s => s.success).length;
    // Estimate similar users found based on algorithm results (approximation)
    const similarUsersFound = allRecommendations.length > 0 
      ? Math.min(allRecommendations.length * 2, 20) // Rough estimate
      : 0;
    
    const confidence = calculateConfidence(
      successfulAlgorithms,
      similarUsersFound,
      isColdStart,
      isHeavyUser,
      recommendations
    );

    const duration = Date.now() - startTime;
    logger.info('Patterns API: request completed', {
      requestId,
      userId,
      recommendationsCount: recommendations.length,
      durationMs: duration,
      context: 'PatternsAPI',
    });

    // Prepare response data
    const responseData = {
      success: true,
      recommendations,
      logIds,
      meta: {
        isColdStart,
        coldStart: {
          threshold: COLD_START_THRESHOLD,
          fallbackSource: isColdStart ? 'tmdb_trending_fallback' : null,
        },
        isHeavyUser,
        heavyUser: isHeavyUser ? {
          threshold: HEAVY_USER_THRESHOLD,
          sampleSize: HEAVY_USER_SAMPLE_SIZE,
        } : null,
        watchedCount,
        algorithmsUsed: isColdStart 
          ? ['tmdb_trending_fallback'] 
          : recommendationAlgorithms.map(a => a.name),
        algorithmsStatus: isColdStart ? {} : algorithmsStatus,
        algorithmTimeouts,
        timeoutThresholdMs: 3000,
        confidence,
        durationMs: duration,
        cacheHit: false,
      },
    };

    // Store in Redis cache
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), { ex: CACHE_TTL_SECONDS });
        logger.info('Patterns API: cached recommendations', {
          requestId,
          userId,
          cacheKey,
          ttlSeconds: CACHE_TTL_SECONDS,
          context: 'PatternsAPI',
        });
      } catch (error) {
        logger.error('Patterns API: cache set failed', {
          requestId,
          userId,
          error: error instanceof Error ? error.message : String(error),
          context: 'PatternsAPI',
        });
      }
    }

    return NextResponse.json(responseData, {
      headers: {
        'X-Cache': 'MISS',
        'X-Cache-Key': cacheKey,
      },
    });
  } catch (error) {
    logger.error('Patterns API: request failed', {
      requestId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      context: 'PatternsAPI',
    });

    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to generate recommendations',
        recommendations: [],
      },
      { status: 500 }
    );
  }
}
