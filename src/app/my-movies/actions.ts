// src/app/my-movies/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS, getStatusIdByName, getStatusNameById } from '@/lib/movieStatusConstants';
import { calculateCineChanceScore } from '@/lib/calculateCineChanceScore';

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

// Функция для получения CineChance рейтингов
async function fetchCineChanceRatings(tmdbIds: number[]) {
  const watchlistRecords = await prisma.watchList.groupBy({
    by: ['tmdbId'],
    _avg: { userRating: true },
    _count: { userRating: true },
    where: { tmdbId: { in: tmdbIds }, userRating: { not: null } },
  });

  const ratingsMap = new Map<number, { averageRating: number; count: number }>();
  watchlistRecords.forEach(record => {
    if (record._avg.userRating && record._count.userRating > 0) {
      ratingsMap.set(record.tmdbId, {
        averageRating: record._avg.userRating,
        count: record._count.userRating,
      });
    }
  });
  return ratingsMap;
}

export interface MovieWithStatus {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  name: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  first_air_date: string;
  overview: string;
  genre_ids: number[];
  original_language: string;
  statusName?: string;
  combinedRating?: number;
  averageRating?: number | null; // Средняя оценка CineChance
  ratingCount?: number; // Количество оценок CineChance
  addedAt?: string;
  userRating?: number | null;
  isBlacklisted?: boolean;
  tags?: Array<{ id: string; name: string }>;
}

export interface PaginatedMovies {
  movies: MovieWithStatus[];
  hasMore: boolean;
  totalCount: number;
}

export interface SortState {
  sortBy: 'popularity' | 'rating' | 'date' | 'savedDate';
  sortOrder: 'desc' | 'asc';
}

const ITEMS_PER_PAGE = 20;

export async function fetchMoviesByStatus(
  userId: string,
  statusName: string | string[] | null, // Может быть массивом для watched (Просмотрено + Пересмотрено)
  includeHidden: boolean,
  page: number = 1,
  sortBy: SortState['sortBy'] = 'rating',
  sortOrder: SortState['sortOrder'] = 'desc',
  limit: number = 20
): Promise<PaginatedMovies> {
  const skip = (page - 1) * limit;
  const take = limit + 1; // Запрашиваем на 1 больше для проверки hasMore

  // Оптимизация: сначала считаем общее количество, затем загружаем только нужную страницу
  const whereClause: Record<string, unknown> = { userId };
  if (statusName) {
    if (Array.isArray(statusName)) {
      const statusIds = statusName.map(name => getStatusIdByName(name)).filter(id => id !== null) as number[];
      if (statusIds.length > 0) {
        whereClause.statusId = { in: statusIds };
      }
    } else {
      const statusId = getStatusIdByName(statusName);
      if (statusId) {
        whereClause.statusId = statusId;
      }
    }
  }

  // 1. Сначала считаем общее количество (быстрый запрос)
  const totalCount = await prisma.watchList.count({ where: whereClause });
  const hasMore = skip + limit < totalCount;

  // 2. Загружаем ТОЛЬКО нужную страницу из БД
  const watchListRecords = await prisma.watchList.findMany({
    where: whereClause,
    select: {
      id: true,
      tmdbId: true,
      mediaType: true,
      title: true,
      voteAverage: true,
      userRating: true,
      addedAt: true,
      statusId: true,
      tags: { select: { id: true, name: true } },
    },
    orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
    skip: skip,
    take: take,
  });

  // 3. Загружаем рейтинги CineChance только для текущей страницы
  const pageTmdbIds = watchListRecords.map(r => r.tmdbId);
  const cineChanceRatings = await fetchCineChanceRatings(pageTmdbIds);

  // 4. Получаем детали TMDB только для текущей страницы
  const moviesWithStatus = await Promise.all(
    watchListRecords.map(async (record: any) => {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
      const cineChanceData = cineChanceRatings.get(record.tmdbId);
      const cineChanceRating = cineChanceData?.averageRating || null;
      const cineChanceVotes = cineChanceData?.count || 0;

      const combinedRating = calculateCineChanceScore({
        tmdbRating: tmdbData?.vote_average || 0,
        tmdbVotes: tmdbData?.vote_count || 0,
        cineChanceRating,
        cineChanceVotes,
      });

      const statusName = getStatusNameById(record.statusId);
      return {
        id: record.tmdbId,
        media_type: record.mediaType as 'movie' | 'tv',
        title: tmdbData?.title || tmdbData?.name || record.title,
        name: tmdbData?.title || tmdbData?.name || record.title,
        poster_path: tmdbData?.poster_path || null,
        vote_average: tmdbData?.vote_average || 0,
        vote_count: tmdbData?.vote_count || 0,
        release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        overview: tmdbData?.overview || '',
        genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
        original_language: tmdbData?.original_language || '',
        statusName: statusName || 'Unknown',
        combinedRating,
        averageRating: cineChanceRating,
        ratingCount: cineChanceVotes,
        addedAt: record.addedAt?.toISOString() || '',
        userRating: record.userRating,
        tags: record.tags || [],
      };
    })
  );

  // 5. Сортируем только полученные записи
  const sortedMovies = sortMoviesOnServer(moviesWithStatus, sortBy, sortOrder);
  const paginatedMovies = sortedMovies;

  // 6. Загружаем hidden фильмы если нужно (только на первой странице)
  let hiddenMovies: MovieWithStatus[] = [];
  let hiddenTotalCount = 0;

  if (includeHidden && page === 1) {
    // Сначала считаем
    hiddenTotalCount = await prisma.blacklist.count({ where: { userId } });

    // Загружаем только нужную страницу
    const blacklistRecords = await prisma.blacklist.findMany({
      where: { userId },
      select: { id: true, tmdbId: true, mediaType: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: skip,
      take: take,
    });

    const blacklistTmdbIds = blacklistRecords.map(r => r.tmdbId);
    const blacklistRatings = await fetchCineChanceRatings(blacklistTmdbIds);

    hiddenMovies = await Promise.all(
      blacklistRecords.map(async (record: any) => {
        const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
        const cineChanceData = blacklistRatings.get(record.tmdbId);
        const cineChanceRating = cineChanceData?.averageRating || null;
        const cineChanceVotes = cineChanceData?.count || 0;

        const combinedRating = calculateCineChanceScore({
          tmdbRating: tmdbData?.vote_average || 0,
          tmdbVotes: tmdbData?.vote_count || 0,
          cineChanceRating,
          cineChanceVotes,
        });

        return {
          id: record.tmdbId,
          media_type: record.mediaType as 'movie' | 'tv',
          title: tmdbData?.title || tmdbData?.name || 'Без названия',
          name: tmdbData?.title || tmdbData?.name || 'Без названия',
          poster_path: tmdbData?.poster_path || null,
          vote_average: tmdbData?.vote_average || 0,
          vote_count: tmdbData?.vote_count || 0,
          release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
          first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
          overview: tmdbData?.overview || '',
          genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
          original_language: tmdbData?.original_language || '',
          combinedRating,
          averageRating: cineChanceRating,
          ratingCount: cineChanceVotes,
          addedAt: record.createdAt?.toISOString() || '',
          userRating: null,
          isBlacklisted: true,
        };
      })
    );

    hiddenMovies = sortMoviesOnServer(hiddenMovies, sortBy, sortOrder);
  }

  return {
    movies: statusName ? paginatedMovies : hiddenMovies,
    hasMore: statusName ? hasMore : (page === 1 && hiddenMovies.length < hiddenTotalCount),
    totalCount: statusName ? totalCount : hiddenTotalCount,
  };
}

// Функция сортировки MovieWithStatus на сервере
function sortMoviesOnServer(
  movies: MovieWithStatus[],
  sortBy: SortState['sortBy'],
  sortOrder: SortState['sortOrder']
): MovieWithStatus[] {
  return [...movies].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'popularity':
        comparison = b.vote_count - a.vote_count;
        break;
      case 'rating':
        const ratingA = a.combinedRating ?? a.vote_average;
        const ratingB = b.combinedRating ?? b.vote_average;
        comparison = ratingB - ratingA;
        break;
      case 'date':
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        comparison = dateB.localeCompare(dateA);
        break;
      case 'savedDate':
        const savedA = a.addedAt || '';
        const savedB = b.addedAt || '';
        comparison = savedB.localeCompare(savedA);
        break;
    }
    
    // Secondary sort by id to ensure stable ordering
    if (comparison === 0) {
      comparison = a.id - b.id;
    }
    
    return sortOrder === 'desc' ? comparison : -comparison;
  });
}

// Функция для получения общего количества фильмов по статусам
export async function getMoviesCounts(userId: string) {
  // Считаем и "Просмотрено" и "Пересмотрено" в одну категорию
  const [watched, wantToWatch, dropped, hidden] = await Promise.all([
    prisma.watchList.count({
      where: {
        userId,
        statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
      },
    }),
    prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH } }),
    prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED } }),
    prisma.blacklist.count({ where: { userId } }),
  ]);

  return { watched, wantToWatch, dropped, hidden };
}

// Функция для получения уникальных жанров из коллекции пользователя
export async function getUserGenres(userId: string): Promise<{ id: number; name: string }[]> {
  // Получаем все записи пользователя
  const watchListRecords = await prisma.watchList.findMany({
    where: { userId },
    select: { tmdbId: true, mediaType: true },
  });

  if (watchListRecords.length === 0) {
    return [];
  }

  // Загружаем детали TMDB для всех записей и собираем уникальные жанры
  const genreSet = new Set<number>();
  const genreNames = new Map<number, string>();

  for (const record of watchListRecords) {
    const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');
    if (tmdbData?.genres) {
      for (const genre of tmdbData.genres) {
        genreSet.add(genre.id);
        genreNames.set(genre.id, genre.name);
      }
    }
  }

  // Преобразуем в массив с названиями
  return Array.from(genreSet).map(id => ({
    id,
    name: genreNames.get(id) || 'Неизвестно',
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Функция для обновления статуса просмотра (из рекомендаций)
export async function updateWatchStatus(
  userId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  newStatus: 'Просмотрено' | 'Пересмотрено',
  rating?: number,
  recommendationLogId?: string
) {
  // Находим или создаем запись в WatchList
  let watchListEntry = await prisma.watchList.findUnique({
    where: {
      userId_tmdbId_mediaType: { userId, tmdbId, mediaType },
    },
  });

  if (!watchListEntry) {
    // Если записи нет, создаем новую
    const tmdbData = await fetchMediaDetails(tmdbId, mediaType);
    const status = await prisma.movieStatus.findUnique({
      where: { name: newStatus },
    });

    if (!status) {
      throw new Error(`Статус ${newStatus} не найден`);
    }

    watchListEntry = await prisma.watchList.create({
      data: {
        userId,
        tmdbId,
        mediaType,
        title: tmdbData?.title || tmdbData?.name || 'Без названия',
        voteAverage: tmdbData?.vote_average || 0,
        statusId: status.id,
        watchCount: 1,
        watchedDate: new Date(),
      },
    });
  } else {
    // Обновляем существующую запись
    const previousWatchCount = watchListEntry.watchCount;
    await prisma.watchList.update({
      where: { id: watchListEntry.id },
      data: {
        watchCount: previousWatchCount + 1,
        watchedDate: new Date(),
        // Если был статус "Хочу посмотреть" или "Брошено", меняем на "Просмотрено"
        // Если уже был "Просмотрено", меняем на "Пересмотрено"
        status: { connect: { name: newStatus } },
      },
    });
  }

  // Создаем запись в RewatchLog с ссылкой на рекомендацию
  await prisma.rewatchLog.create({
    data: {
      userId,
      tmdbId,
      mediaType,
      watchedAt: new Date(),
      previousWatchCount: watchListEntry.watchCount,
      recommendationLogId: recommendationLogId || null,
    },
  });

  // Если оценка передана, создаем запись в RatingHistory
  if (rating !== undefined) {
    await prisma.ratingHistory.create({
      data: {
        userId,
        tmdbId,
        mediaType,
        rating,
        actionType: 'rewatch',
      },
    });

    // Также обновляем userRating в WatchList
    await prisma.watchList.update({
      where: { id: watchListEntry.id },
      data: { userRating: rating },
    });
  }

  return { success: true };
}
