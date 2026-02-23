import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint for ML recommendation system statistics
 * Returns ML-specific metrics: algorithm performance, user segments, predictions
 */

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations');
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too Many Requests' },
      { status: 429 }
    );
  }
  
  try {
    const { prisma } = await import('@/lib/prisma');

    // Cold start threshold
    const COLD_START_THRESHOLD = 10;
    const HEAVY_USER_THRESHOLD = 500;

    // Get overview stats from RecommendationLog
    const [
      totalRecommendations,
      recommendationLogs,
      predictionOutcomes,
      modelCorrections,
      allUsers,
    ] = await Promise.all([
      // Total recommendations generated (all logs)
      prisma.recommendationLog.count(),
      
      // Sample logs for action stats (last 30 days for performance)
      prisma.recommendationLog.findMany({
        where: {
          shownAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          algorithm: true,
          action: true,
          score: true,
        },
        take: 10000,
      }),
      
      // Get prediction outcomes for discrepancy metrics
      prisma.predictionOutcome.findMany({
        where: {
          recommendedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          wasSuccessful: true,
          userAction: true,
        },
        take: 5000,
      }),
      
      // Get active model corrections
      prisma.modelCorrection.count({
        where: { isActive: true },
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
    ]);

    // Calculate overview metrics
    const totalShown = recommendationLogs.filter((l) => l.action !== null).length;
    const totalAddedToWant = recommendationLogs.filter(
      (l) => l.action === 'added_to_want' || l.action === 'want'
    ).length;
    const totalWatched = recommendationLogs.filter(
      (l) => l.action === 'watched'
    ).length;
    
    const acceptanceRate = totalShown > 0 ? totalWatched / totalShown : 0;
    const wantRate = totalShown > 0 ? totalAddedToWant / totalShown : 0;
    const watchRate = totalShown > 0 ? totalWatched / totalShown : 0;

    // Algorithm performance
    const algorithmPerformance: Record<string, { total: number; success: number; failure: number; successRate: number }> = {};
    
    for (const log of recommendationLogs) {
      if (!algorithmPerformance[log.algorithm]) {
        algorithmPerformance[log.algorithm] = { total: 0, success: 0, failure: 0, successRate: 0 };
      }
      algorithmPerformance[log.algorithm].total++;
      
      if (log.action === 'added_to_want' || log.action === 'want' || log.action === 'watched') {
        algorithmPerformance[log.algorithm].success++;
      } else if (log.action !== null) {
        algorithmPerformance[log.algorithm].failure++;
      }
    }
    
    // Calculate success rates
    for (const alg of Object.keys(algorithmPerformance)) {
      const data = algorithmPerformance[alg];
      data.successRate = data.total > 0 ? data.success / data.total : 0;
    }

    // User segments
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

    // Discrepancy metrics (predicted vs actual)
    const predicted = predictionOutcomes.length;
    const actual = predictionOutcomes.filter((o) => o.wasSuccessful).length;
    const accuracy = predicted > 0 ? actual / predicted : 0;

    // Correction counts
    const corrections = {
      active: modelCorrections,
      pending: 0, // Could track expired ones if needed
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      overview: {
        totalRecommendations,
        totalShown,
        totalAddedToWant,
        totalWatched,
        acceptanceRate,
        wantRate,
        watchRate,
      },
      algorithmPerformance,
      userSegments: {
        coldStart,
        activeUsers,
        heavyUsers,
      },
      discrepancy: {
        predicted,
        actual,
        accuracy,
      },
      corrections,
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
