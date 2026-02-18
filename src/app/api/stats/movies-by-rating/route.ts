// src/app/api/stats/movies-by-rating/route.ts

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
    
    // Основные параметры
    const ratingParam = searchParams.get('rating');
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';
    
    // Параметры фильтрации
    const showMoviesParam = searchParams.get('showMovies') === 'true';
    const showTvParam = searchParams.get('showTv') === 'true';
    const showAnimeParam = searchParams.get('showAnime') === 'true';
    const showCartoonParam = searchParams.get('showCartoon') === 'true';
    const sortByParam = searchParams.get('sortBy') || 'rating';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    const minRatingParam = parseFloat(searchParams.get('minRating') || '0');
    const maxRatingParam = parseFloat(searchParams.get('maxRating') || '10');
    const yearFromParam = searchParams.get('yearFrom');
    const yearToParam = searchParams.get('yearTo');
    const genresParam = searchParams.get('genres');
    const tagsParam = searchParams.get('tags');

    logger.debug('movies-by-rating params', {
      ratingParam,
      showMoviesParam,
      showTvParam,
      showAnimeParam,
      sortByParam,
      sortOrderParam,
      minRatingParam,
      maxRatingParam,
      yearFromParam,
      yearToParam,
      genresParam,
      tagsParam,
    });

    if (!ratingParam) {
      return NextResponse.json({ error: 'rating parameter is required' }, { status: 400 });
    }

    const targetRating = Math.round(parseFloat(ratingParam));
    if (isNaN(targetRating) || targetRating < 1 || targetRating > 10) {
      return NextResponse.json({ error: 'invalid rating value' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(pageParam, 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10)));
    
    // Pagination - запрос на 1 больше для проверки hasMore
    const skip = (page - 1) * limit;
    const take = limit + 1;

    // Строим фильтр по медиа типам
    const mediaTypeFilter: string[] = [];
    if (showMoviesParam) mediaTypeFilter.push('movie');
    if (showTvParam) mediaTypeFilter.push('tv');
    
    // Если ничего не выбрано, показываем всё (анимация фильтруется через TMDB)
    const mediaTypes = mediaTypeFilter.length > 0 ? mediaTypeFilter : ['movie', 'tv'];



    // Парсим жанры если переданы
    const genresArray = genresParam ? genresParam.split(',').map(g => parseInt(g, 10)).filter(g => !isNaN(g)) : [];

    // Парсим теги если переданы
    const tagsArray = tagsParam ? tagsParam.split(',').filter(t => t.length > 0) : [];

    // Строим where clause
    const whereClause = {
      userId,
      userRating: targetRating,
      statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] },
      mediaType: { in: mediaTypes },
      ...(tagsArray.length > 0 && {
        tags: {
          some: {
            id: { in: tagsArray }
          }
        }
      })
    };

    // Считаем всего (для будущего использования)
    const _totalCount = await prisma.watchList.count({ where: whereClause });

    // Получаем записи
    const watchListRecords = await prisma.watchList.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        userRating: true,
        statusId: true,
        addedAt: true,
        tags: { select: { id: true, name: true } },
      },
      orderBy: getBenefitsOrder(sortByParam, sortOrderParam),
      skip,
      take,
    });

    // Получаем детали TMDB для каждого фильма
    const movies = await Promise.all(
      watchListRecords.map(async (record) => {
        const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');

        // Применяем фильтары по рейтингу TMDB, году и жанрам
        const tmdbRating = tmdbData?.vote_average || 0;
        const releaseYear = new Date(tmdbData?.release_date || tmdbData?.first_air_date || '').getFullYear();
        const genres = tmdbData?.genres?.map((g: any) => g.id) || [];

        // Фильтрация по типу контента на основе TMDB данных
        const isAnimeItem = isAnime(tmdbData);
        const isCartoonItem = isCartoon(tmdbData);
        const isRegularContent = !isAnimeItem && !isCartoonItem;
        
        // Показываем аниме только если включен showAnime
        if (isAnimeItem && !showAnimeParam) return null;
        // Показываем мульты только если включен showCartoon  
        if (isCartoonItem && !showCartoonParam) return null;
        // Показываем обычные фильмы/сериалы только если включены showMovies или showTv
        if (isRegularContent && !showMoviesParam && record.mediaType === 'movie') return null;
        if (isRegularContent && !showTvParam && record.mediaType === 'tv') return null;

        // Проверяем фильтры
        if (tmdbRating < minRatingParam || tmdbRating > maxRatingParam) return null;
        if (yearFromParam && releaseYear < parseInt(yearFromParam, 10)) return null;
        if (yearToParam && releaseYear > parseInt(yearToParam, 10)) return null;
        if (genresArray.length > 0 && !genres.some((g: number) => genresArray.includes(g))) return null;

        return {
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
          genre_ids: genres,
          original_language: tmdbData?.original_language || '',
          userRating: record.userRating,
          statusId: record.statusId,
          statusName: getStatusNameById(record.statusId) || 'Просмотрено',
          addedAt: record.addedAt?.toISOString() || '',
          tags: record.tags || [],
        };
      })
    );

    // Фильтруем null значения (из-за несовпадения фильтров)
    const filteredMovies = movies.filter((m): m is Exclude<typeof m, null> => m !== null);

    // Сортируем отфильтрованные результаты по выбранному критерию
    const sortedMovies = filteredMovies.sort((a: any, b: any) => {
      let comparison = 0;

      switch (sortByParam) {
        case 'popularity':
          comparison = b.vote_count - a.vote_count;
          break;
        case 'rating':
          comparison = b.vote_average - a.vote_average;
          break;
        case 'date':
          const dateA = a.release_date || a.first_air_date || '';
          const dateB = b.release_date || b.first_air_date || '';
          comparison = dateB.localeCompare(dateA);
          break;
        case 'addedAt':
        case 'savedDate':
          const savedA = a.addedAt || '';
          const savedB = b.addedAt || '';
          comparison = savedB.localeCompare(savedA);
          break;
        default:
          comparison = 0;
      }

      // Secondary sort by id for stable ordering
      if (comparison === 0) {
        comparison = a.id - b.id;
      }

      return sortOrderParam === 'desc' ? comparison : -comparison;
    });

    // Собираем уникальные жанры из результатов
    const genreSet = new Set<number>();
    const genreMap: Record<number, string> = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    };
    
    sortedMovies.forEach((movie) => {
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

    // Paginate filtered results
    const paginatedMovies = sortedMovies.slice(0, limit);
    
    // hasMore: true if we got more than limit (meaning there's more data)
    const hasMore = watchListRecords.length > limit;

    const response = NextResponse.json({
      movies: paginatedMovies,
      availableGenres,
      pagination: {
        page,
        limit,
        totalCount: filteredMovies.length,
        totalPages: Math.ceil(filteredMovies.length / limit),
        hasMore,
      },
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    logger.error('Error fetching movies by rating', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

function getBenefitsOrder(sortBy: string, sortOrder: string): any[] {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  
  switch (sortBy) {
    case 'title':
      return [{ title: order }, { id: 'desc' }];
    case 'addedAt':
      return [{ addedAt: order }, { id: 'desc' }];
    case 'userRating':
      return [{ userRating: order }, { id: 'desc' }];
    case 'rating':
    default:
      return [{ userRating: order }, { id: 'desc' }];
  }
}
