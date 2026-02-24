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
      
      // Unique users with active recommendations
      prisma.recommendationLog.groupBy({
        by: ['userId'],
        where: {
          algorithm: 'random_v1',
        },
      }),
    ]);

    const uniqueUsers = uniqueUsersCount.length;

    return NextResponse.json({
      success: true,
      overview: {
        totalGenerated,
        totalShown,
        uniqueUsers,
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
