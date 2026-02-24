import { NextRequest, NextResponse } from 'next/server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { calculateAcceptanceRate, getAlgorithmPerformance, getOutcomeStats } from '@/lib/recommendation-outcome-tracking';

/**
 * API endpoint for ML recommendation system statistics
 * Returns ML-specific metrics: algorithm performance, user segments, predictions, outcome tracking
 */

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations/ml-stats');
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too Many Requests' },
      { status: 429 }
    );
  }

  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { prisma } = await import('@/lib/prisma');

    // Cold start threshold
    const COLD_START_THRESHOLD = 10;
    const HEAVY_USER_THRESHOLD = 500;
    const DATE_RANGE_7_DAYS = 7;
    const DATE_RANGE_30_DAYS = 30;

    // Get overview stats from RecommendationLog
    const [
      totalRecommendations,
      totalShown,
      totalAddedToWant,
      totalWatched,
      totalDropped,
      totalHidden,
      allUsers,
      uniqueUsersGrouped,
    ] = await Promise.all([
      // Passive recommendations - сгенерировано (source: 'patterns_api')
      prisma.recommendationLog.count({
        where: {
          context: {
            path: ['source'],
            equals: 'patterns_api',
          },
        },
      }),
      
      // Показано - action='shown' с фильтром по source='patterns_api'
      prisma.recommendationLog.count({
        where: {
          context: {
            path: ['source'],
            equals: 'patterns_api',
          },
          action: 'shown',
        },
      }),
      
      // Добавлено в хочу - из RecommendationEvent, связанных с passive рекомендациями
      prisma.recommendationEvent.count({
        where: {
          eventType: 'added',
          parentLog: {
            context: {
              path: ['source'],
              equals: 'patterns_api',
            },
          },
        },
      }),
      
      // Просмотрено (с оценкой) - из RecommendationEvent
      prisma.recommendationEvent.count({
        where: {
          eventType: 'rated',
          parentLog: {
            context: {
              path: ['source'],
              equals: 'patterns_api',
            },
          },
        },
      }),
      
      // Брошено - из RecommendationEvent
      prisma.recommendationEvent.count({
        where: {
          eventType: 'dropped',
          parentLog: {
            context: {
              path: ['source'],
              equals: 'patterns_api',
            },
          },
        },
      }),
      
      // Скрыто - из RecommendationEvent
      prisma.recommendationEvent.count({
        where: {
          eventType: 'hidden',
          parentLog: {
            context: {
              path: ['source'],
              equals: 'patterns_api',
            },
          },
        },
      }),
       
      // Get all users with watch count
      prisma.user.findMany({
        select: {
          id: true,
          watchList: {
            select: { id: true },
          },
        },
      }),

      // Unique users with passive recommendations
      prisma.recommendationLog.groupBy({
        by: ['userId'],
        where: {
          context: {
            path: ['source'],
            equals: 'patterns_api',
          },
        },
      }),
    ]);

    const uniqueUsersWithRecs = uniqueUsersGrouped.length;

    // Get first user ID for algorithm performance (fallback if no user)
    const firstUserId = allUsers.length > 0 ? allUsers[0].id : 'system';

    // Get algorithm performance using tracking functions
    const [last7DaysAlgorithmPerf, last30DaysAlgorithmPerf, overallAlgorithmPerf] = await Promise.all([
      // Algorithm performance for last 7 days
      getAlgorithmPerformance(firstUserId, {
        start: new Date(Date.now() - DATE_RANGE_7_DAYS * 24 * 60 * 60 * 1000),
        end: new Date(),
      }),
      // Algorithm performance for last 30 days
      getAlgorithmPerformance(firstUserId, {
        start: new Date(Date.now() - DATE_RANGE_30_DAYS * 24 * 60 * 60 * 1000),
        end: new Date(),
      }),
      // Overall algorithm performance
      getAlgorithmPerformance(firstUserId, undefined),
    ]);

    // Calculate user segments
    let coldStart = 0;
    let activeUsers = 0;
    let heavyUsers = 0;
    
    for (const user of allUsers) {
      const watchCount = user.watchList.length;
      if (watchCount < COLD_START_THRESHOLD) {
        coldStart++;
      } else if (watchCount >= HEAVY_USER_THRESHOLD) {
        heavyUsers++;
      } else {
        activeUsers++;
      }
    }

    // Calculate rates
    const acceptanceRate = totalShown > 0 ? (totalAddedToWant + totalWatched) / totalShown : 0;
    const wantRate = totalShown > 0 ? totalAddedToWant / totalShown : 0;
    const watchRate = totalShown > 0 ? totalWatched / totalShown : 0;

    // Map algorithm performance to expected format
    const algorithmPerformance: Record<string, { total: number; success: number; failure: number; successRate: number }> = {};
    for (const perf of overallAlgorithmPerf.byAlgorithm) {
      algorithmPerformance[perf.algorithm] = {
        total: perf.shown,
        success: perf.accepted,
        failure: perf.shown - perf.accepted,
        successRate: perf.shown > 0 ? perf.accepted / perf.shown : 0,
      };
    }

    return NextResponse.json({
      success: true,
      overview: {
        totalRecommendations,
        totalShown: uniqueUsersWithRecs,
        totalAddedToWant,
        totalWatched,
        totalDropped,
        totalHidden,
        acceptanceRate,
        wantRate,
        watchRate,
      },
      algorithmPerformance,
      userSegments: {
        totalUsers: allUsers.length,
        coldStart,
        activeUsers: activeUsers, // Use already calculated value
        heavyUsers,
        coldStartThreshold: COLD_START_THRESHOLD,
        heavyUserThreshold: HEAVY_USER_THRESHOLD,
      },
      discrepancy: {
        predicted: 0,
        actual: 0,
        accuracy: 0,
      },
      corrections: {
        active: 0,
        pending: 0,
      },
    });

  } catch (error) {
    logger.error('ML Stats error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'MLDashboard'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ML stats' },
      { status: 500 }
    );
  }
}
