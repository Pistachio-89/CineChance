// src/app/api/admin/users/[userId]/genres/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { withCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';

// Genre ID to name mapping (TMDb + Anime genres)
const GENRE_MAP: Record<number, string> = {
  // TMDb Genres
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  // Anime-specific genre IDs (using higher numbers to avoid conflicts)
  100: 'Action Anime',
  101: 'Adventure Anime',
  102: 'Comedy Anime',
  103: 'Drama Anime',
  104: 'Fantasy Anime',
  105: 'Horror Anime',
  106: 'Mecha Anime',
  107: 'Music Anime',
  108: 'Mystery Anime',
  109: 'Psychological Anime',
  110: 'Romance Anime',
  111: 'Sci-Fi Anime',
  112: 'Slice of Life Anime',
  113: 'Sports Anime',
  114: 'Supernatural Anime',
  115: 'Thriller Anime',
};

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

// Helper function to fetch media details from TMDB
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    if (session.user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const statusesParam = searchParams.get('statuses');
    const mediaFilter = searchParams.get('media');
    const validMedia = ['movie', 'tv', 'cartoon', 'anime'].includes(mediaFilter || '') ? mediaFilter : null;
    
    const cacheKey = `admin:user:${userId}:genres:${validMedia || 'all'}:${statusesParam || 'default'}`;

    const fetchGenres = async () => {
      const whereClause: Record<string, unknown> = { userId };
      
      if (!statusesParam) {
        whereClause.statusId = { 
          in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] 
        };
      } else {
        const statusList = statusesParam.split(',').map(s => s.trim().toLowerCase());
        
        if (statusList.includes('watched') || statusList.includes('rewatched')) {
          whereClause.statusId = { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] };
        }
      }

      // Add DB-level filter for movie/tv
      if (validMedia === 'movie' || validMedia === 'tv') {
        whereClause.mediaType = validMedia;
      }

      const watchListRecords = await prisma.watchList.findMany({
        where: whereClause,
        select: { tmdbId: true, mediaType: true },
      });

      if (watchListRecords.length === 0) {
        return { genres: [] };
      }

      const genreCounts = new Map<number, number>();
      const genreNames = new Map<number, string>();
      
      const BATCH_SIZE = 3;
      const needsMediaFiltering = validMedia === 'cartoon' || validMedia === 'anime';

      for (let i = 0; i < watchListRecords.length; i += BATCH_SIZE) {
        const batch = watchListRecords.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(record => fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv'))
        );
        
        for (let j = 0; j < batchResults.length; j++) {
          const tmdbData = batchResults[j];
          
          // If filtering by cartoon/anime, check media type classification
          if (needsMediaFiltering) {
            const isAnimeContent = isAnime(tmdbData);
            const isCartoonContent = isCartoon(tmdbData);
            
            const matchesFilter = 
              (validMedia === 'anime' && isAnimeContent) ||
              (validMedia === 'cartoon' && isCartoonContent);
            
            if (!matchesFilter) {
              continue; // Skip this record
            }
          }
          
          if (tmdbData?.genres) {
            for (const genre of tmdbData.genres) {
              genreCounts.set(genre.id, (genreCounts.get(genre.id) || 0) + 1);
              genreNames.set(genre.id, genre.name);
            }
          }
        }
      }

      const genres = Array.from(genreCounts.entries())
        .map(([id, count]) => ({
          id,
          name: genreNames.get(id) || GENRE_MAP[id] || `Genre ${id}`,
          count,
        }))
        .sort((a, b) => b.count - a.count);

      return { genres };
    };

    const result = await withCache(cacheKey, fetchGenres, 1800);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching admin user genres', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'AdminGenresAPI'
    });
    return NextResponse.json(
      { error: 'Failed to fetch genres' },
      { status: 500 }
    );
  }
}
