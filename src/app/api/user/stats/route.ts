// src/app/api/user/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { rateLimit } from '@/middleware/rateLimit';
import { withCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const PARALLEL_TMDB_REQUESTS = 10;

async function fetchMediaDetailsBatch(
  records: Array<{ tmdbId: number; mediaType: string }>
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  if (!TMDB_API_KEY) {
    return results;
  }

  const batches: Array<Array<{ tmdbId: number; mediaType: string }>> = [];
  for (let i = 0; i < records.length; i += PARALLEL_TMDB_REQUESTS) {
    batches.push(records.slice(i, i + PARALLEL_TMDB_REQUESTS));
  }

  for (const batch of batches) {
    const promises = batch.map(async (record) => {
      const key = `${record.mediaType}:${record.tmdbId}`;
      const url = `https://api.themoviedb.org/3/${record.mediaType}/${record.tmdbId}?api_key=${TMDB_API_KEY}&language=ru-RU`;
      
      try {
        const res = await fetch(url, { next: { revalidate: 86400 } });
        if (res.ok) {
          const data = await res.json();
          results.set(key, data);
        }
      } catch {
        // Silently fail for individual requests
      }
    });
    
    await Promise.all(promises);
  }

  return results;
}

function isAnime(movie: any): boolean {
  const hasAnimeGenre = movie.genres?.some((g: any) => g.id === 16) ?? false;
  const isJapanese = movie.original_language === 'ja';
  return hasAnimeGenre && isJapanese;
}

function isCartoon(movie: any): boolean {
  const hasAnimationGenre = movie.genres?.some((g: any) => g.id === 16) ?? false;
  const isNotJapanese = movie.original_language !== 'ja';
  return hasAnimationGenre && isNotJapanese;
}

async function calculateTypeBreakdown(
  allRecords: Array<{ tmdbId: number; mediaType: string }>
): Promise<{ movie: number; tv: number; cartoon: number; anime: number }> {
  const typeCounts = { movie: 0, tv: 0, cartoon: 0, anime: 0 };
  
  if (allRecords.length === 0) {
    return typeCounts;
  }

  const tmdbDataMap = await fetchMediaDetailsBatch(allRecords);
  
  for (const record of allRecords) {
    const key = `${record.mediaType}:${record.tmdbId}`;
    const tmdbData = tmdbDataMap.get(key);
    
    if (tmdbData) {
      if (isAnime(tmdbData)) {
        typeCounts.anime++;
      } else if (isCartoon(tmdbData)) {
        typeCounts.cartoon++;
      } else if (record.mediaType === 'movie') {
        typeCounts.movie++;
      } else if (record.mediaType === 'tv') {
        typeCounts.tv++;
      }
    } else {
      if (record.mediaType === 'movie') typeCounts.movie++;
      else if (record.mediaType === 'tv') typeCounts.tv++;
    }
  }
  
  return typeCounts;
}

async function fetchStats(userId: string) {
  const [watchedCount, wantToWatchCount, droppedCount, hiddenCount] = await Promise.all([
    prisma.watchList.count({
      where: {
        userId,
        statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
      },
    }),
    prisma.watchList.count({
      where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH },
    }),
    prisma.watchList.count({
      where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED },
    }),
    prisma.blacklist.count({ where: { userId } }),
  ]);

  const allRecords = await prisma.watchList.findMany({
    where: {
      userId,
      statusId: { 
        in: [
          MOVIE_STATUS_IDS.WANT_TO_WATCH, 
          MOVIE_STATUS_IDS.WATCHED, 
          MOVIE_STATUS_IDS.REWATCHED, 
          MOVIE_STATUS_IDS.DROPPED
        ] 
      },
    },
    select: {
      tmdbId: true,
      mediaType: true,
    },
  });

  const typeCounts = await calculateTypeBreakdown(allRecords);

  logger.info('Fetching average rating', { userId, context: 'UserStatsAPI' });

  const avgRatingResult = await prisma.watchList.aggregate({
    where: {
      userId,
      statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] },
      userRating: { not: null },
    },
    _avg: { 
      userRating: true,
    },
    _count: { 
      userRating: true,
    },
  });

  logger.info('Average rating result', { 
    avgRatingResult: JSON.stringify(avgRatingResult),
    context: 'UserStatsAPI' 
  });

  const avg = avgRatingResult._avg;
  const count = avgRatingResult._count;
  const averageRating = avg?.userRating ?? null;
  const finalAverageRating = averageRating ? Math.round(averageRating * 10) / 10 : null;
  const ratedCount = count?.userRating || 0;

  logger.info('Calculated average rating', { 
    averageRating, 
    finalAverageRating, 
    ratedCount,
    context: 'UserStatsAPI' 
  });

  const ratingGroups = await prisma.watchList.groupBy({
    by: ['userRating'],
    where: {
      userId,
      statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
      userRating: { not: null },
    },
    _count: {
      userRating: true,
    },
  });

  const ratingDistribution: Record<number, number> = {};
  for (let i = 10; i >= 1; i--) {
    ratingDistribution[i] = 0;
  }

  for (const group of ratingGroups) {
    if (group.userRating !== null) {
      const roundedRating = Math.round(group.userRating);
      if (roundedRating >= 1 && roundedRating <= 10) {
        ratingDistribution[roundedRating] = group._count.userRating;
      }
    }
  }

  const totalForPercentage = watchedCount + wantToWatchCount + droppedCount;

  return {
    total: {
      watched: watchedCount,
      wantToWatch: wantToWatchCount,
      dropped: droppedCount,
      hidden: hiddenCount,
      totalForPercentage,
    },
    typeBreakdown: typeCounts,
    averageRating: finalAverageRating,
    ratedCount,
    ratingDistribution,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { success } = await rateLimit(request, '/api/user/stats');
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const cacheKey = `user:${userId}:stats`;

    const responseData = await withCache(cacheKey, () => fetchStats(userId), 3600);

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Error fetching user stats', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'UserStatsAPI'
    });
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
