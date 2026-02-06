import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';

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

// Helper function to fetch media details from TMDB
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusesParam = searchParams.get('statuses');
    const limitParam = searchParams.get('limit');
    
    // Определяем фильтр по статусам
    let whereClause: any = { userId: session.user.id };
    
    if (statusesParam) {
      const statusList = statusesParam.split(',').map(s => s.trim().toLowerCase());
      
      if (statusList.includes('watched') || statusList.includes('rewatched')) {
        whereClause.statusId = { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] };
      }
    }

    // Ограничиваем количество записей для анализа (по умолчанию 50)
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Fetch movie entries from user's watch lists
    const watchListRecords = await prisma.watchList.findMany({
      where: whereClause,
      select: { tmdbId: true, mediaType: true },
      take: limit,
    });

    if (watchListRecords.length === 0) {
      return NextResponse.json({ genres: [] });
    }

    // Load TMDB details for records in parallel batches (обрабатываем по 3 одновременно)
    const genreCounts = new Map<number, number>();
    const genreNames = new Map<number, string>();
    
    const BATCH_SIZE = 3; // Обрабатываем по 3 фильма одновременно

    // Обрабатываем записи батчами
    for (let i = 0; i < watchListRecords.length; i += BATCH_SIZE) {
      const batch = watchListRecords.slice(i, i + BATCH_SIZE);
      
      // Выполняем все запросы в батче параллельно
      const batchResults = await Promise.all(
        batch.map(record => fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv'))
      );
      
      // Обрабатываем результаты
      for (const tmdbData of batchResults) {
        if (tmdbData?.genres) {
          for (const genre of tmdbData.genres) {
            genreCounts.set(genre.id, (genreCounts.get(genre.id) || 0) + 1);
            genreNames.set(genre.id, genre.name);
          }
        }
      }
    }

    // Convert to array with names and counts
    const genres = Array.from(genreCounts.entries())
      .map(([id, count]) => ({
        id,
        name: genreNames.get(id) || GENRE_MAP[id] || `Genre ${id}`,
        count,
      }))
      .sort((a, b) => b.count - a.count); // Сортируем по количеству (desc)

    const response = NextResponse.json({ genres });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching user genres:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genres' },
      { status: 500 }
    );
  }
}
