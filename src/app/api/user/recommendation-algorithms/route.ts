import { NextRequest, NextResponse } from 'next/server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

// All algorithms in the system
const ALL_ALGORITHMS = [
  'random_v1',
  'taste_match_v1',
  'want_overlap_v1',
  'drop_patterns_v1',
  'type_twins_v1',
  'person_twins_v1',
  'person_recommendations_v1',
  'genre_twins_v1',
  'genre_recommendations_v1',
];

/**
 * GET /api/user/recommendation-algorithms
 * 
 * Returns per-user statistics about which algorithms generated recommendations for them.
 * Shows how many times each algorithm was used in recommendations shown to this user.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  // Rate limiting
  const { success } = await rateLimit(request, '/api/user/recommendation-algorithms');
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too Many Requests' },
      { status: 429 }
    );
  }

  // Check authentication - require userId param or session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use session userId if no param provided
  const targetUserId = userId || session.user.id;

  try {
    // Get algorithm usage stats for this user
    // Count recommendations by algorithm where user saw them
    const algorithmStats = await Promise.all(
      ALL_ALGORITHMS.map(async (algorithm) => {
        // Count shown recommendations from this algorithm
        const shownCount = await prisma.recommendationLog.count({
          where: {
            userId: targetUserId,
            algorithm,
            action: 'shown',
          },
        });

        // Get last time this algorithm was used for this user
        const lastLog = await prisma.recommendationLog.findFirst({
          where: {
            userId: targetUserId,
            algorithm,
          },
          orderBy: { shownAt: 'desc' },
          select: { shownAt: true },
        });

        // Count positive outcomes (added + rated) from this algorithm
        const positiveCount = await prisma.recommendationEvent.count({
          where: {
            eventType: { in: ['added', 'rated'] },
            parentLog: {
              userId: targetUserId,
              algorithm,
            },
          },
        });

        // Count negative outcomes (dropped + hidden)
        const negativeCount = await prisma.recommendationEvent.count({
          where: {
            eventType: { in: ['dropped', 'hidden'] },
            parentLog: {
              userId: targetUserId,
              algorithm,
            },
          },
        });

        return {
          name: algorithm,
          shown: shownCount,
          positive: positiveCount,
          negative: negativeCount,
          lastUsed: lastLog ? lastLog.shownAt.toISOString() : null,
        };
      })
    );

    // Filter to only show algorithms that have been used
    const usedAlgorithms = algorithmStats.filter(a => a.shown > 0);

    // Sort by shown count descending
    usedAlgorithms.sort((a, b) => b.shown - a.shown);

    // Calculate totals
    const totalShown = usedAlgorithms.reduce((sum, a) => sum + a.shown, 0);
    const totalPositive = usedAlgorithms.reduce((sum, a) => sum + a.positive, 0);
    const totalNegative = usedAlgorithms.reduce((sum, a) => sum + a.negative, 0);

    return NextResponse.json({
      success: true,
      algorithms: usedAlgorithms,
      summary: {
        totalShown,
        totalPositive,
        totalNegative,
        uniqueAlgorithms: usedAlgorithms.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user recommendation algorithms stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: targetUserId,
      context: 'UserRecommendationAlgorithms',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
