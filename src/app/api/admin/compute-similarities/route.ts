/**
 * Admin endpoint for manual similarity score computation
 * POST /api/admin/compute-similarities
 * 
 * Triggers the computation of similarity scores between users
 * Requires admin privileges
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { computeAllSimilarityScores } from '@/lib/tasks/computeSimilarityScores';
import { getSimilarityScoreStats } from '@/lib/taste-map/similarity-storage';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'cmkbc7sn2000104k3xd3zyf2a';

/**
 * POST /api/admin/compute-similarities
 * 
 * Trigger manual computation of similarity scores
 * Query parameters:
 * - limit: number of users to process (default 100)
 * - offset: starting offset (default 0) - for batch processing
 * 
 * Returns:
 * - processed: number of users processed
 * - computed: number of similarity scores computed
 * - errors: number of errors encountered
 * - errorsList: list of errors
 * - duration: computation duration in ms
 * - stats: database statistics
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Rate limiting (more permissive for admin)
  const { success } = await rateLimit(request, '/api/admin/compute-similarities');
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  try {
    // Authentication - check admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
      logger.warn('Unauthorized admin endpoint access', {
        userId: session?.user?.id,
        context: 'AdminComputeSimilarities',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    logger.info('Starting manual similarity computation', {
      limit,
      offset,
      adminId: session.user.id,
      context: 'AdminComputeSimilarities',
    });

    // Run computation
    const result = await computeAllSimilarityScores({
      limit,
      offset,
      onProgress: (progress) => {
        logger.debug('Computation progress', {
          ...progress,
          context: 'AdminComputeSimilarities',
        });
      },
    });

    // Get stats
    const stats = await getSimilarityScoreStats();

    logger.info('Manual similarity computation completed', {
      processed: result.processed,
      computed: result.computed,
      errors: result.errors,
      duration: result.duration,
      context: 'AdminComputeSimilarities',
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} users, computed ${result.computed} similarity scores`,
      result: {
        processed: result.processed,
        computed: result.computed,
        errors: result.errors,
        errorsList: result.errorsList,
        duration: result.duration,
        timestamp: result.timestamp,
      },
      stats: {
        totalScores: stats.totalScores,
        uniqueUsers: stats.uniqueUsers,
        averageMatch: Number((stats.averageMatch * 100).toFixed(1)),
        lastComputed: stats.lastComputed?.toISOString(),
        schedulerLastRun: stats.schedulerLastRun?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Manual similarity computation failed', {
      error: error instanceof Error ? error.message : String(error),
      context: 'AdminComputeSimilarities',
    });

    return NextResponse.json(
      {
        error: 'Computation failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/compute-similarities/status
 * 
 * Get current status and statistics of similarity scores
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication - check admin
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await getSimilarityScoreStats();

    return NextResponse.json({
      stats: {
        totalScores: stats.totalScores,
        uniqueUsers: stats.uniqueUsers,
        averageMatch: Number((stats.averageMatch * 100).toFixed(1)),
        lastComputed: stats.lastComputed?.toISOString(),
        schedulerLastRun: stats.schedulerLastRun?.toISOString(),
      },
      message: 'Statistics retrieved successfully',
    });
  } catch (error) {
    logger.error('Failed to get similarity statistics', {
      error: error instanceof Error ? error.message : String(error),
      context: 'AdminComputeSimilarities',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
