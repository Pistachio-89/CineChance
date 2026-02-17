// src/app/api/stats/movies-by-genre/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS, getStatusNameById } from '@/lib/movieStatusConstants';
import { rateLimit } from '@/middleware/rateLimit';
import { logger } from '@/lib/logger';

// Вспомогательная функция для получения деталей с TMDB
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24 часа
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    const { success } = await rateLimit(request, '/api/stats', userId);
    if (!success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const searchParams = request.nextUrl.searchParams;
    const genreIdParam = searchParams.get('genreId');
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';
    
    // Параметры фильтрации
    const showMoviesParam = searchParams.get('showMovies') === 'true';
    const showTvParam = searchParams.get('showTv') === 'true';
    const showAnimeParam = searchParams.get('showAnime') === 'true';
    const showCartoonParam = searchParams.get('showCartoon') === 'true';
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
    
    // Simple pagination - запрос на 1 больше для проверки hasMore
    const skip = (page - 1) * limit;
    const take = limit + 1;

    // Строим фильтр по медиа типам
    const mediaTypeFilter: string[] = [];
    if (showMoviesParam) mediaTypeFilter.push('movie');
    if (showTvParam) mediaTypeFilter.push('tv');
    
    // Если ничего не выбрано, показываем всё (movie и tv - анимация фильтруется через TMDB)
    const mediaTypes = mediaTypeFilter.length > 0 ? mediaTypeFilter : ['movie', 'tv'];

    // Парсим жанры если переданы (для фильтрации по дополнительным жанрам)
    const genresArray = genresParam ? genresParam.split(',').map(g => parseInt(g, 10)).filter(g => !isNaN(g)) : [];

    // Парсим теги если переданы
    const tagsArray = tagsParam ? tagsParam.split(',').filter(t => t.length > 0) : [];

    // Получаем фильмы пользователя (включая все статусы для полной статистики)
    const whereClause: any = {
      userId,
      statusId: {
        in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED],
      },
      mediaType: { in: mediaTypes },
    };

    // Если есть теги для фильтрации, добавляем их в where clause
    // Теги хранятся в поле tags как связь many-to-many
    let tagsFilter = undefined;
    if (tagsArray.length > 0) {
      tagsFilter = {
        some: {
          tags: {
            some: {
              id: { in: tagsArray }
            }
          }
        }
      };
    }

    // Получаем записи с буфером для фильтрации по жанру
    const watchListRecords = await prisma.watchList.findMany({
      where: {
        ...whereClause,
        ...(tagsFilter && { AND: [tagsFilter] }),
      },
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        userRating: true,
        addedAt: true,
        statusId: true,
      },
      orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });

    // Параллельная загрузка TMDB данных с батчингом
    const BATCH_SIZE = 5;
    const moviesWithGenre: Array<{ record: any; tmdbData: any }> = [];
    
    for (let i = 0; i < watchListRecords.length; i += BATCH_SIZE) {
      const batch = watchListRecords.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(record => fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv'))
      );
      
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const tmdbData = batchResults[j];
        
        if (!tmdbData?.genres?.some((g: any) => g.id === genreId)) continue;
        
        const tmdbRating = tmdbData?.vote_average || 0;
        const releaseYear = new Date(tmdbData?.release_date || tmdbData?.first_air_date || '').getFullYear();
        const genres = tmdbData?.genres?.map((g: any) => g.id) || [];

        // Фильтрация по типу контента на основе TMDB данных
        const isAnimeItem = isAnime(tmdbData);
        const isCartoonItem = isCartoon(tmdbData);
        const isRegularContent = !isAnimeItem && !isCartoonItem;
        
        // Показываем аниме только если включен showAnime
        if (isAnimeItem && !showAnimeParam) continue;
        // Показываем мульты только если включен showCartoon  
        if (isCartoonItem && !showCartoonParam) continue;
        // Показываем обычные фильмы/сериалы только если включены showMovies или showTv
        if (isRegularContent && !showMoviesParam && record.mediaType === 'movie') continue;
        if (isRegularContent && !showTvParam && record.mediaType === 'tv') continue;

        if (tmdbRating < minRatingParam || tmdbRating > maxRatingParam) continue;
        if (yearFromParam && releaseYear < parseInt(yearFromParam, 10)) continue;
        if (yearToParam && releaseYear > parseInt(yearToParam, 10)) continue;
        if (genresArray.length > 0 && !genres.some((g: number) => genresArray.includes(g))) continue;

        moviesWithGenre.push({
          record,
          tmdbData,
        });
      }
    }

    // Применяем сортировку
    const sorted = applySorting(moviesWithGenre, sortByParam, sortOrderParam);
    const totalCount = sorted.length;
    
    // Paginate filtered results
    const paginatedMovies = sorted.slice(0, limit);
    
    // hasMore: true if we got more than limit (meaning there's more data)
    const hasMore = watchListRecords.length > limit;

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
      statusId: record.statusId,
      statusName: getStatusNameById(record.statusId) || 'Просмотрено',
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
        hasMore,
      },
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    logger.error('Error fetching movies by genre', { error: error instanceof Error ? error.message : String(error) });
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
    let comparison = 0;

    switch (sortBy) {
      case 'popularity':
        comparison = (b.tmdbData?.vote_count || 0) - (a.tmdbData?.vote_count || 0);
        break;
      case 'rating':
        comparison = (b.tmdbData?.vote_average || 0) - (a.tmdbData?.vote_average || 0);
        break;
      case 'date':
        const dateA = a.tmdbData?.release_date || a.tmdbData?.first_air_date || '';
        const dateB = b.tmdbData?.release_date || b.tmdbData?.first_air_date || '';
        comparison = dateB.localeCompare(dateA);
        break;
      case 'addedAt':
      case 'savedDate':
        comparison = new Date(b.record.addedAt || 0).getTime() - new Date(a.record.addedAt || 0).getTime();
        break;
      case 'title':
        const titleA = a.record.title || '';
        const titleB = b.record.title || '';
        comparison = titleA.localeCompare(titleB);
        break;
      default:
        comparison = new Date(b.record.addedAt || 0).getTime() - new Date(a.record.addedAt || 0).getTime();
    }

    // Secondary sort by id for stable ordering
    if (comparison === 0) {
      comparison = a.record.id - b.record.id;
    }

    return comparison * order;
  });
}
