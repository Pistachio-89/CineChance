// src/app/api/stats/movies-by-tag/route.ts
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
    const { success } = await rateLimit(request, '/api/stats/movies-by-tag');
    if (!success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const tagIdParam = searchParams.get('tagId');
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

    if (!tagIdParam) {
      return NextResponse.json({ error: 'tagId parameter is required' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(pageParam, 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10)));
    const skip = (page - 1) * limit;

    // Проверяем что тег принадлежит пользователю
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagIdParam,
        userId,
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Строим фильтр по медиа типам
    const mediaTypeFilter: string[] = [];
    if (showMoviesParam) mediaTypeFilter.push('movie');
    if (showTvParam) mediaTypeFilter.push('tv');
    if (showAnimeParam) mediaTypeFilter.push('anime');
    
    // Если ничего не выбрано, показываем всё
    const mediaTypes = mediaTypeFilter.length > 0 ? mediaTypeFilter : ['movie', 'tv', 'anime'];

    // Парсим жанры если переданы
    const genresArray = genresParam ? genresParam.split(',').map(g => parseInt(g, 10)).filter(g => !isNaN(g)) : [];

    // Парсим теги если переданы
    const tagsArray = tagsParam ? tagsParam.split(',').filter(t => t.length > 0) : [];

    // Получаем фильмы с данным тегом
    const whereClause: any = {
      tags: {
        some: {
          id: tagIdParam,
        },
      },
      statusId: {
        in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.WANT_TO_WATCH, MOVIE_STATUS_IDS.DROPPED],
      },
      mediaType: { in: mediaTypes },
    };

    // Если есть дополнительные теги для фильтрации (кроме основного тега)
    if (tagsArray.length > 0) {
      whereClause.tags = {
        some: {
          id: {
            in: [tagIdParam, ...tagsArray], // Включаем основной тег и дополнительные теги
          },
        },
      };
    }

    // Считаем всего
    const totalCount = await prisma.watchList.count({
      where: whereClause,
    });

    // Получаем страницу
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
      take: limit,
    });

    // Получаем детали TMDB для каждого фильма
    const movies = await Promise.all(
      watchListRecords.map(async (record) => {
        const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');

        // Применяем фильтры по рейтингу TMDB, году и жанрам
        const tmdbRating = tmdbData?.vote_average || 0;
        const releaseYear = new Date(tmdbData?.release_date || tmdbData?.first_air_date || '').getFullYear();
        const genres = tmdbData?.genres?.map((g: any) => g.id) || [];

        // Проверяем фильтры
        if (tmdbRating < minRatingParam || tmdbRating > maxRatingParam) return null;
        if (yearFromParam && releaseYear < parseInt(yearFromParam, 10)) return null;
        if (yearToParam && releaseYear > parseInt(yearToParam, 10)) return null;
        if (genresArray.length > 0 && !genres.some(g => genresArray.includes(g))) return null;

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
          addedAt: record.addedAt?.toISOString() || '',
          tags: record.tags || [],
        };
      })
    );

    // Фильтруем null значения (из-за несовпадения фильтров)
    const filteredMovies = movies.filter((m): m is Exclude<typeof m, null> => m !== null);

    // Собираем уникальные жанры из результатов
    const genreSet = new Set<number>();
    const genreMap: Record<number, string> = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
      99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
      27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    };
    
    filteredMovies.forEach((movie) => {
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
      tag: {
        id: tag.id,
        name: tag.name,
      },
      movies: filteredMovies,
      availableGenres,
      pagination: {
        page,
        limit,
        totalCount: filteredMovies.length,
        totalPages: Math.ceil(filteredMovies.length / limit),
        hasMore: skip + limit < filteredMovies.length,
      },
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Error fetching movies by tag:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

function getBenefitsOrder(sortBy: string, sortOrder: string) {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  
  switch (sortBy) {
    case 'title':
      return { title: order };
    case 'addedAt':
      return { addedAt: order };
    case 'userRating':
      return { userRating: order };
    case 'rating':
    default:
      return { addedAt: order };
  }
}
