// src/app/api/stats/movies-by-genre/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { rateLimit } from '@/middleware/rateLimit';

// Вспомогательная функция для получения деталей с TMDB
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24 часа
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { success } = await rateLimit(request, '/api/stats/movies-by-genre');
    if (!success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const genreIdParam = searchParams.get('genreId');
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';
    
    // Параметры фильтрации
    const showMoviesParam = searchParams.get('showMovies') === 'true';
    const showTvParam = searchParams.get('showTv') === 'true';
    const showAnimeParam = searchParams.get('showAnime') === 'true';
    const sortByParam = searchParams.get('sortBy') || 'addedAt';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    const minRatingParam = parseFloat(searchParams.get('minRating') || '0');
    const maxRatingParam = parseFloat(searchParams.get('maxRating') || '10');
    const yearFromParam = searchParams.get('yearFrom');
    const yearToParam = searchParams.get('yearTo');
    const genresParam = searchParams.get('genres');
    const tagsParam = searchParams.get('tags');

    if (!genreIdParam) {
      return NextResponse.json({ error: 'genreId parameter is required' }, { status: 400 });
    }

    const genreId = parseInt(genreIdParam, 10);
    if (isNaN(genreId)) {
      return NextResponse.json({ error: 'invalid genreId value' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(pageParam, 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10)));
    const skip = (page - 1) * limit;

    // Строим фильтр по медиа типам
    const mediaTypeFilter: string[] = [];
    if (showMoviesParam) mediaTypeFilter.push('movie');
    if (showTvParam) mediaTypeFilter.push('tv');
    if (showAnimeParam) mediaTypeFilter.push('anime');
    
    // Если ничего не выбрано, показываем всё
    const mediaTypes = mediaTypeFilter.length > 0 ? mediaTypeFilter : ['movie', 'tv', 'anime'];

    // Парсим жанры если переданы (для фильтрации по дополнительным жанрам)
    const genresArray = genresParam ? genresParam.split(',').map(g => parseInt(g, 10)).filter(g => !isNaN(g)) : [];

    // Парсим теги если переданы
    const tagsArray = tagsParam ? tagsParam.split(',').filter(t => t.length > 0) : [];

    // Получаем фильмы пользователя (watched/rewatched статусы по умолчанию)
    const whereClause: any = {
      userId,
      statusId: {
        in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED],
      },
      mediaType: { in: mediaTypes },
    };

    // Если есть теги для фильтрации, добавляем их в where clause
    if (tagsArray.length > 0) {
      whereClause.tags = {
        some: {
          id: { in: tagsArray }
        }
      };
    }

    // Получаем все записи пользователя БЕЗ тегов (оптимизация: теги будут загружены ниже)
    const watchListRecords = await prisma.watchList.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        userRating: true,
        addedAt: true,
      },
    });

    // Фильтруем по жанру и применяем доп. фильтры
    const moviesWithGenre = [];
    for (const record of watchListRecords) {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');
      
      // Проверяем основной жанр
      if (!tmdbData?.genres?.some((g: any) => g.id === genreId)) continue;
      
      // Применяем доп. фильтры
      const tmdbRating = tmdbData?.vote_average || 0;
      const releaseYear = new Date(tmdbData?.release_date || tmdbData?.first_air_date || '').getFullYear();
      const genres = tmdbData?.genres?.map((g: any) => g.id) || [];

      if (tmdbRating < minRatingParam || tmdbRating > maxRatingParam) continue;
      if (yearFromParam && releaseYear < parseInt(yearFromParam, 10)) continue;
      if (yearToParam && releaseYear > parseInt(yearToParam, 10)) continue;
      if (genresArray.length > 0 && !genres.some(g => genresArray.includes(g))) continue;

      moviesWithGenre.push({
        record,
        tmdbData,
      });
    }

    // Применяем сортировку
    const sorted = applySorting(moviesWithGenre, sortByParam, sortOrderParam);
    const totalCount = sorted.length;
    const paginatedMovies = sorted.slice(skip, skip + limit);

    // Загружаем теги только для записей, которые попадут в ответ
    const recordIdsForTags = paginatedMovies.map(m => m.record.id);
    const tagsMap = new Map<string, any[]>();
    
    if (recordIdsForTags.length > 0) {
      const tagsData = await prisma.watchList.findMany({
        where: { id: { in: recordIdsForTags } },
        select: {
          id: true,
          tags: { select: { id: true, name: true } },
        },
      });
      
      tagsData.forEach(item => {
        tagsMap.set(item.id, item.tags);
      });
    }

    // Формируем ответ
    const movies = paginatedMovies.map(({ record, tmdbData }) => ({
      id: record.tmdbId,
      media_type: record.mediaType as 'movie' | 'tv' | 'anime',
      title: tmdbData?.title || tmdbData?.name || record.title || 'Unknown',
      name: tmdbData?.title || tmdbData?.name || record.title || 'Unknown',
      poster_path: tmdbData?.poster_path || null,
      vote_average: tmdbData?.vote_average || 0,
      vote_count: tmdbData?.vote_count || 0,
      release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
      first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
      overview: tmdbData?.overview || '',
      genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
      original_language: tmdbData?.original_language || '',
      userRating: record.userRating,
      addedAt: record.addedAt?.toISOString() || '',
      tags: tagsMap.get(record.id) || [],
    }));

    // Собираем уникальные жанры из результатов
    const genreSet = new Set<number>();
    const genreMap: Record<number, string> = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    };
    
    movies.forEach((movie) => {
      if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
        movie.genre_ids.forEach((gid: number) => genreSet.add(gid));
      }
    });
    
    const availableGenres = Array.from(genreSet)
      .sort()
      .map((id) => ({
        id,
        name: genreMap[id] || `Genre ${id}`,
      }));

    const response = NextResponse.json({
      genreId,
      movies,
      availableGenres,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount,
      },
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Error fetching movies by genre:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

function applySorting(
  movies: Array<{ record: any; tmdbData: any }>,
  sortBy: string,
  sortOrder: string
): Array<{ record: any; tmdbData: any }> {
  const order = sortOrder === 'asc' ? 1 : -1;

  return [...movies].sort((a, b) => {
    let aVal: any = '';
    let bVal: any = '';

    switch (sortBy) {
      case 'title':
        aVal = a.record.title || '';
        bVal = b.record.title || '';
        return aVal.localeCompare(bVal) * order;
      case 'userRating':
        aVal = a.record.userRating || 0;
        bVal = b.record.userRating || 0;
        return (aVal - bVal) * order;
      case 'addedAt':
      default:
        aVal = new Date(a.record.addedAt || 0).getTime();
        bVal = new Date(b.record.addedAt || 0).getTime();
        return (aVal - bVal) * order;
    }
  });
}
