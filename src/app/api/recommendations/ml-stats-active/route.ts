import { NextRequest, NextResponse } from 'next/server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint for Active recommendations statistics
 * Returns metrics for /api/recommendations/random (active recommendations)
 */

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations/ml-stats-active');
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

    // Active recommendations - algorithm = 'random_v1' (from /api/recommendations/random)
    const [
      totalGenerated,
      totalShown,
      totalAddedToWant,
      totalWatched,
      totalDropped,
      totalHidden,
      uniqueUsersCount,
    ] = await Promise.all([
      // Active recommendations - сгенерировано (algorithm = 'random_v1')
      prisma.recommendationLog.count({
        where: {
          algorithm: 'random_v1',
        },
      }),
      
      // Показано
      prisma.recommendationLog.count({
        where: {
          algorithm: 'random_v1',
          action: 'shown',
        },
      }),
      
      // Добавлено в хочу - из RecommendationEvent
      prisma.recommendationEvent.count({
        where: {
          eventType: 'added',
          parentLog: {
            algorithm: 'random_v1',
          },
        },
      }),
      
      // Просмотрено
      prisma.recommendationEvent.count({
        where: {
          eventType: 'rated',
          parentLog: {
            algorithm: 'random_v1',
          },
        },
      }),
      
      // Брошено
      prisma.recommendationEvent.count({
        where: {
          eventType: 'dropped',
          parentLog: {
            algorithm: 'random_v1',
          },
        },
      }),
      
      // Скрыто
      prisma.recommendationEvent.count({
        where: {
          eventType: 'hidden',
          parentLog: {
            algorithm: 'random_v1',
          },
        },
      }),
      
      // Unique users with active recommendations
      prisma.recommendationLog.groupBy({
        by: ['userId'],
        where: {
          algorithm: 'random_v1',
        },
      }),
    ]);

    const uniqueUsers = uniqueUsersCount.length;
    
    // Calculate rates
    const wantRate = totalShown > 0 ? totalAddedToWant / totalShown : 0;
    const watchRate = totalShown > 0 ? totalWatched / totalShown : 0;

    return NextResponse.json({
      success: true,
      overview: {
        totalGenerated,
        totalShown,
        totalAddedToWant,
        totalWatched,
        totalDropped,
        totalHidden,
        uniqueUsers,
        wantRate,
        watchRate,
      },
    });

  } catch (error) {
    logger.error('Active ML Stats error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'ActiveMLDashboard'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch active ML stats' },
      { status: 500 }
    );
  }
}
