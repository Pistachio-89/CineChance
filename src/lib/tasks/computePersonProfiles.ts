// filepath: src/lib/tasks/computePersonProfiles.ts
/**
 * Task: Compute person profiles for all users
 * Runs full recalculation of top-50 actors/directors for each user
 * Use in scheduler for weekly or manual admin trigger
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { computeUserPersonProfile } from '@/lib/taste-map/person-profile-v2';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';

export interface ComputePersonProfilesResult {
  processed: number;
  computed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

/**
 * Compute person profiles for all active users
 * @param limit - Max users to process in one batch
 * @param offset - Skip first N users
 * @param onProgress - Optional callback for progress updates
 */
export async function computeAllPersonProfiles(
  options?: {
    limit?: number;
    offset?: number;
    onProgress?: (progress: { processed: number; total: number; current: string }) => void;
  }
): Promise<ComputePersonProfilesResult> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const onProgress = options?.onProgress;

  const startTime = Date.now();
  const results: ComputePersonProfilesResult = {
    processed: 0,
    computed: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
  };

  try {
    // Get active users (those with watched/rewatched movies)
    const activeUsers = await prisma.user.findMany({
      take: limit,
      skip: offset,
      where: {
        watchList: {
          some: {
            statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    logger.info('Starting person profiles computation', {
      usersCount: activeUsers.length,
      limit,
      offset,
    });

    for (const user of activeUsers) {
      try {
        onProgress?.({
          processed: results.processed,
          total: activeUsers.length,
          current: user.id,
        });

        // Compute actors
        await computeUserPersonProfile(user.id, 'actor');
        results.computed += 1;

        // Compute directors
        await computeUserPersonProfile(user.id, 'director');
        results.computed += 1;

        results.processed += 1;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`User ${user.id}: ${errorMsg}`);
        logger.error('Error computing person profile for user', {
          userId: user.id,
          error: errorMsg,
        });
      }
    }

    results.duration = Date.now() - startTime;

    logger.info('Completed person profiles computation', {
      processed: results.processed,
      computed: results.computed,
      errors: results.errors.length,
      duration: results.duration,
    });

    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.errors.push(`Batch error: ${errorMsg}`);
    results.duration = Date.now() - startTime;

    logger.error('Error in compute all person profiles', {
      error: errorMsg,
    });

    return results;
  }
}

/**
 * Schedule weekly computation using node-cron
 * Run every Monday at 2:00 AM UTC
 *
 * Usage: in your app startup
 * import { scheduleWeeklyPersonProfileComputation } from '@/lib/tasks/computePersonProfiles';
 * scheduleWeeklyPersonProfileComputation();
 */
export async function scheduleWeeklyPersonProfileComputation(): Promise<void> {
  try {
    // TODO: Implement with node-cron or similar scheduler
    // const cron = require('node-cron');
    // cron.schedule('0 2 * * 1', async () => {  // 2 AM Monday
    //   logger.info('Running scheduled person profiles computation');
    //   const result = await computeAllPersonProfiles({ limit: 100 });
    //   logger.info('Scheduled computation completed', { result });
    // });

    logger.info('Person profiles scheduler ready (not yet implemented)');
  } catch (error) {
    logger.error('Error scheduling person profiles computation', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
