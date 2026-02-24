import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Outcome tracking module for ML feedback loop.
 * Tracks when users interact with recommendations and calculates performance metrics.
 */

export type OutcomeAction = 'added' | 'rated' | 'ignored' | 'dropped' | 'hidden';
export type OutcomeRating = number; // 1-10

export interface TrackOutcomeParams {
  recommendationLogId: string;
  action: OutcomeAction;
  userRating?: OutcomeRating;
}

export interface OutcomeData {
  outcomeAction: OutcomeAction;
  outcomeRating?: OutcomeRating;
  outcomeAt: Date;
  predictionScore?: number;
  algorithm?: string;
}

/**
 * Track a user's outcome on a recommendation.
 * Creates a RecommendationEvent to log the interaction.
 */
export async function trackOutcome(params: TrackOutcomeParams): Promise<void> {
  try {
    const { recommendationLogId, action, userRating } = params;

    // Create outcome event
    await prisma.recommendationEvent.create({
      data: {
        parentLogId: recommendationLogId,
        eventType: action,
        eventData: userRating ? { rating: userRating } : undefined,
        timestamp: new Date(),
      },
    });

    logger.info('Outcome tracked', {
      recommendationLogId,
      action,
      userRating,
      context: 'recommendation-outcome-tracking',
    });
  } catch (error) {
    logger.error('Failed to track outcome', {
      error: error instanceof Error ? error.message : String(error),
      context: 'recommendation-outcome-tracking',
    });
    // Don't throw - tracking failures shouldn't block user actions
  }
}

/**
 * Calculate acceptance rate for a user.
 * Returns percentage of recommendations the user acted on (added/rated).
 */
export async function calculateAcceptanceRate(
  userId: string,
  algorithm?: string,
  dateRange?: { start: Date; end: Date }
): Promise<{ overallRate: number; accepted: number; shown: number }> {
  try {
    const where: any = {
      userId,
      eventType: { in: ['added', 'rated'] },
    };

    if (algorithm) {
      where.parentLog = { algorithm };
    }

    if (dateRange) {
      where.timestamp = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    // Get recommendation logs shown to user
    const shownWhere: any = {
      userId,
      shownAt: dateRange ? { gte: dateRange.start, lte: dateRange.end } : undefined,
    };

    if (algorithm) {
      shownWhere.algorithm = algorithm;
    }

    const [shownCount, eventCount] = await Promise.all([
      prisma.recommendationLog.count({ where: shownWhere }),
      prisma.recommendationEvent.count({ where }),
    ]);

    const overallRate = shownCount > 0 ? (eventCount / shownCount) * 100 : 0;

    return {
      overallRate: Math.round(overallRate * 10) / 10, // Round to 1 decimal
      accepted: eventCount,
      shown: shownCount,
    };
  } catch (error) {
    logger.error('Failed to calculate acceptance rate', {
      error: error instanceof Error ? error.message : String(error),
      context: 'recommendation-outcome-tracking',
    });
    return { overallRate: 0, accepted: 0, shown: 0 };
  }
}

/**
 * Get algorithm performance metrics based on outcome tracking.
 * Returns acceptance rates and acceptance counts per algorithm.
 */
export async function getAlgorithmPerformance(
  userId: string,
  dateRange?: { start: Date; end: Date }
): Promise<{
  overall: { rate: number; accepted: number; shown: number };
  byAlgorithm: Array<{
    algorithm: string;
    rate: number;
    accepted: number;
    shown: number;
  }>;
}> {
  try {
    // Get shown recommendations for this user
    const where: any = {
      userId,
      shownAt: dateRange ? { gte: dateRange.start, lte: dateRange.end } : undefined,
    };

    const shownLogs = await prisma.recommendationLog.findMany({
      where,
      select: { algorithm: true },
    });

    const algorithms = Array.from(new Set(shownLogs.map((log) => log.algorithm))).filter(
      Boolean
    );

    // Calculate acceptance rate for each algorithm
    const byAlgorithm = await Promise.all(
      algorithms.map(async (algorithm) => {
        const result = await calculateAcceptanceRate(userId, algorithm, dateRange);
        return {
          algorithm,
          rate: result.overallRate,
          accepted: result.accepted,
          shown: result.shown,
        };
      })
    );

    // Calculate overall rate
    const totalShown = shownLogs.length;
    const totalAccepted = byAlgorithm.reduce((sum, item) => sum + item.accepted, 0);
    const overallRate = totalShown > 0 ? (totalAccepted / totalShown) * 100 : 0;

    return {
      overall: {
        rate: Math.round(overallRate * 10) / 10,
        accepted: totalAccepted,
        shown: totalShown,
      },
      byAlgorithm,
    };
  } catch (error) {
    logger.error('Failed to get algorithm performance', {
      error: error instanceof Error ? error.message : String(error),
      context: 'recommendation-outcome-tracking',
    });
    return {
      overall: { rate: 0, accepted: 0, shown: 0 },
      byAlgorithm: [],
    };
  }
}

/**
 * Get algorithm performance metrics aggregated across ALL users in the system.
 * Includes ALL algorithms (active and passive).
 */
export async function getSystemAlgorithmPerformance(): Promise<{
  overall: { rate: number; accepted: number; shown: number; negative: number };
  byAlgorithm: Array<{
    algorithm: string;
    rate: number;
    accepted: number;
    shown: number;
    negative: number;
    dropped: number;
    hidden: number;
  }>;
}> {
  try {
    // Get all unique algorithms from ALL recommendation logs
    const allLogs = await prisma.recommendationLog.findMany({
      where: {
        action: 'shown',
      },
      select: { algorithm: true },
      distinct: ['algorithm'],
    });

    const algorithms = allLogs.map((log) => log.algorithm).filter(Boolean);

    if (algorithms.length === 0) {
      return {
        overall: { rate: 0, accepted: 0, shown: 0, negative: 0 },
        byAlgorithm: [],
      };
    }

    // Calculate metrics for each algorithm across all users
    const byAlgorithm = await Promise.all(
      algorithms.map(async (algorithm) => {
        // Count total shown for this algorithm
        const shownCount = await prisma.recommendationLog.count({
          where: {
            algorithm,
            action: 'shown',
          },
        });

        // Count accepted (added + rated) for this algorithm
        const acceptedCount = await prisma.recommendationEvent.count({
          where: {
            eventType: { in: ['added', 'rated'] },
            parentLog: {
              algorithm,
            },
          },
        });

        // Count negative outcomes (dropped + hidden)
        const droppedCount = await prisma.recommendationEvent.count({
          where: {
            eventType: 'dropped',
            parentLog: {
              algorithm,
            },
          },
        });

        const hiddenCount = await prisma.recommendationEvent.count({
          where: {
            eventType: 'hidden',
            parentLog: {
              algorithm,
            },
          },
        });

        const negativeCount = droppedCount + hiddenCount;
        const rate = shownCount > 0 ? (acceptedCount / shownCount) * 100 : 0;

        return {
          algorithm,
          rate: Math.round(rate * 10) / 10,
          accepted: acceptedCount,
          shown: shownCount,
          negative: negativeCount,
          dropped: droppedCount,
          hidden: hiddenCount,
        };
      })
    );

    // Calculate overall rate
    const totalShown = byAlgorithm.reduce((sum, item) => sum + item.shown, 0);
    const totalAccepted = byAlgorithm.reduce((sum, item) => sum + item.accepted, 0);
    const totalNegative = byAlgorithm.reduce((sum, item) => sum + item.negative, 0);
    const overallRate = totalShown > 0 ? (totalAccepted / totalShown) * 100 : 0;

    return {
      overall: {
        rate: Math.round(overallRate * 10) / 10,
        accepted: totalAccepted,
        shown: totalShown,
        negative: totalNegative,
      },
      byAlgorithm,
    };
  } catch (error) {
    logger.error('Failed to get system algorithm performance', {
      error: error instanceof Error ? error.message : String(error),
      context: 'recommendation-outcome-tracking',
    });
    return {
      overall: { rate: 0, accepted: 0, shown: 0, negative: 0 },
      byAlgorithm: [],
    };
  }
}

/**
 * Get outcome statistics over time.
 * Returns counts for added/rated/ignored actions per day.
 */
export async function getOutcomeStats(
  userId: string,
  algorithm?: string,
  days?: number
): Promise<
  Array<{
    date: string;
    added: number;
    rated: number;
    ignored: number;
    total: number;
  }>
> {
  try {
    const startDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

    const where: any = {
      userId,
      timestamp: startDate ? { gte: startDate } : undefined,
    };

    if (algorithm) {
      where.parentLog = { algorithm };
    }

    // Group events by date and type
    const events = await prisma.recommendationEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    });

    // Group by date
    const statsMap = new Map<string, { added: number; rated: number; ignored: number }>();

    events.forEach((event) => {
      const date = event.timestamp.toISOString().split('T')[0];
      if (!statsMap.has(date)) {
        statsMap.set(date, { added: 0, rated: 0, ignored: 0 });
      }

      const stats = statsMap.get(date)!;
      stats[event.eventType as 'added' | 'rated' | 'ignored']++;
    });

    // Convert to array sorted by date
    const stats = Array.from(statsMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
        total: counts.added + counts.rated + counts.ignored,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  } catch (error) {
    logger.error('Failed to get outcome stats', {
      error: error instanceof Error ? error.message : String(error),
      context: 'recommendation-outcome-tracking',
    });
    return [];
  }
}
