// src/app/api/admin/users/[userId]/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { rateLimit } from '@/middleware/rateLimit';
import { withCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const PARALLEL_TMDB_REQUESTS = 10;

async function fetchMediaDetailsBatch(
  records: Array<{ tmdbId: number; mediaType: string }>
): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>();
  
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

function isAnime(movie: unknown): boolean {
  if (!movie || typeof movie !== 'object') return false;
  const m = movie as Record<string, unknown>;
  const genres = m.genres as Array<{ id: number }> | undefined;
  const hasAnimeGenre = genres?.some((g) => g.id === 16) ?? false;
  const isJapanese = m.original_language === 'ja';
  return hasAnimeGenre && isJapanese;
}

function isCartoon(movie: unknown): boolean {
  if (!movie || typeof movie !== 'object') return false;
  const m = movie as Record<string, unknown>;
  const genres = m.genres as Array<{ id: number }> | undefined;
  const hasAnimationGenre = genres?.some((g) => g.id === 16) ?? false;
  const isNotJapanese = m.original_language !== 'ja';
  return hasAnimationGenre && isNotJapanese;
}

/**
 * Returns DB-level filter condition for movie/tv.
 * For cartoon/anime, returns null (in-memory filtering required).
 */
function getMediaTypeCondition(
  mediaType: string
): { mediaType?: string } | null {
  if (!mediaType) return null;

  if (mediaType === 'movie' || mediaType === 'tv') {
    return { mediaType };
  }

  // cartoon/anime require in-memory filtering based on TMDB data
  return null;
}

/**
 * Classifies a media record as movie/tv/cartoon/anime based on TMDB data.
 */
function classifyMediaType(
  tmdbData: unknown,
  dbMediaType: string
): 'movie' | 'tv' | 'cartoon' | 'anime' {
  if (tmdbData && typeof tmdbData === 'object') {
    if (isAnime(tmdbData)) return 'anime';
    if (isCartoon(tmdbData)) return 'cartoon';
  }
  return dbMediaType as 'movie' | 'tv';
}

/**
 * Filters records in-memory for cartoon/anime types.
 */
async function filterRecordsByMediaType(
  records: Array<{ tmdbId: number; mediaType: string; statusId: number; userRating: number | null }>,
  filterType: 'cartoon' | 'anime'
): Promise<Array<{ tmdbId: number; mediaType: string; statusId: number; userRating: number | null }>> {
  const tmdbDataMap = await fetchMediaDetailsBatch(records);
  const filteredRecords: Array<{ tmdbId: number; mediaType: string; statusId: number; userRating: number | null }> = [];

  for (const record of records) {
    const key = `${record.mediaType}:${record.tmdbId}`;
    const tmdbData = tmdbDataMap.get(key);
    const classifiedType = classifyMediaType(tmdbData, record.mediaType);

    if (classifiedType === filterType) {
      filteredRecords.push(record);
    }
  }

  return filteredRecords;
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

async function fetchStats(userId: string, mediaFilter?: string | null) {
  const needsInMemoryFilter = mediaFilter === 'cartoon' || mediaFilter === 'anime';
  const mediaFilterCondition = mediaFilter ? getMediaTypeCondition(mediaFilter) : undefined;

  if (needsInMemoryFilter) {
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
        statusId: true,
        userRating: true,
      },
    });

    const filterType = mediaFilter as 'cartoon' | 'anime';
    const filteredRecords = await filterRecordsByMediaType(allRecords, filterType);

    const watchedCount = filteredRecords.filter(
      r => r.statusId === MOVIE_STATUS_IDS.WATCHED || r.statusId === MOVIE_STATUS_IDS.REWATCHED
    ).length;
    const wantToWatchCount = filteredRecords.filter(
      r => r.statusId === MOVIE_STATUS_IDS.WANT_TO_WATCH
    ).length;
    const droppedCount = filteredRecords.filter(
      r => r.statusId === MOVIE_STATUS_IDS.DROPPED
    ).length;

    const hiddenCount = await prisma.blacklist.count({ where: { userId } });

    const allRecordsForBreakdown = await prisma.watchList.findMany({
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
    const typeCounts = await calculateTypeBreakdown(allRecordsForBreakdown);

    const ratedRecords = filteredRecords.filter(r => r.userRating !== null);
    const ratedCount = ratedRecords.length;
    const averageRating = ratedCount > 0
      ? Math.round((ratedRecords.reduce((sum, r) => sum + (r.userRating || 0), 0) / ratedCount) * 10) / 10
      : null;

    const ratingDistribution: Record<number, number> = {};
    for (let i = 10; i >= 1; i--) {
      ratingDistribution[i] = 0;
    }
    for (const record of ratedRecords) {
      if (record.userRating !== null) {
        const roundedRating = Math.round(record.userRating);
        if (roundedRating >= 1 && roundedRating <= 10) {
          ratingDistribution[roundedRating]++;
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
      averageRating,
      ratedCount,
      ratingDistribution,
    };
  }

  const [watchedCount, wantToWatchCount, droppedCount, hiddenCount] = await Promise.all([
    prisma.watchList.count({
      where: {
        userId,
        statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
        ...mediaFilterCondition,
      },
    }),
    prisma.watchList.count({
      where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH, ...mediaFilterCondition },
    }),
    prisma.watchList.count({
      where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED, ...mediaFilterCondition },
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
      ...mediaFilterCondition,
    },
    select: {
      tmdbId: true,
      mediaType: true,
    },
  });

  const typeCounts = await calculateTypeBreakdown(allRecords);

  const avgRatingResult = await prisma.watchList.aggregate({
    where: {
      userId,
      statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] },
      userRating: { not: null },
      ...mediaFilterCondition,
    },
    _avg: { 
      userRating: true,
    },
    _count: { 
      userRating: true,
    },
  });

  const avg = avgRatingResult._avg;
  const count = avgRatingResult._count;
  const averageRating = avg?.userRating ?? null;
  const finalAverageRating = averageRating ? Math.round(averageRating * 10) / 10 : null;
  const ratedCount = count?.userRating || 0;

  const ratingGroups = await prisma.watchList.groupBy({
    by: ['userRating'],
    where: {
      userId,
      statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] },
      userRating: { not: null },
      ...mediaFilterCondition,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { success } = await rateLimit(request, '/api/admin/user/stats');
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    if (session.user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const mediaFilter = searchParams.get('media');
    const validMedia = ['movie', 'tv', 'cartoon', 'anime'].includes(mediaFilter || '') ? mediaFilter : null;
    const cacheKey = `admin:user:${userId}:stats:${validMedia || 'all'}`;

    const responseData = await withCache(cacheKey, () => fetchStats(userId, validMedia), 3600);

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Error fetching admin user stats', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'AdminUserStatsAPI'
    });
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
