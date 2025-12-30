// src/app/my-movies/page.tsx
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import MyMoviesClient from './MyMoviesClient';
import { Media } from '@/lib/tmdb';
import { calculateCineChanceScore } from '@/lib/calculateCineChanceScore';

// Вспомогательная функция для получения деталей с TMDB (бережем копипасту)
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

// Функция для получения CineChance рейтингов для списка фильмов
// Вычисляет среднее всех оценок для каждого фильма из таблицы watchList
async function fetchCineChanceRatings(tmdbIds: number[]) {
  // Получаем все записи watchlist с оценками для данных tmdbId
  const watchlistRecords = await prisma.watchList.groupBy({
    by: ['tmdbId'],
    _avg: {
      userRating: true,
    },
    _count: {
      userRating: true,
    },
    where: {
      tmdbId: { in: tmdbIds },
      userRating: { not: null },
    },
  });

  // Создаём карту с данными для каждого фильма
  const ratingsMap = new Map<number, {
    averageRating: number;
    count: number;
  }>();

  // Заполняем карту средними значениями
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

export default async function MyMoviesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white text-lg mb-6">Войдите, чтобы управлять своими списками фильмов</p>
          <Link href="/" className="text-blue-400 hover:underline">← На главную</Link>
        </div>
      </div>
    );
  }

  // 1. Загружаем WatchList (список просмотров)
  const watchListRecords = await prisma.watchList.findMany({
    where: { userId: session.user.id as string },
    include: { status: true },
    orderBy: { addedAt: 'desc' },
  });

  // 2. Загружаем Blacklist (скрытые фильмы)
  const blacklistRecords = await prisma.blacklist.findMany({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: 'desc' },
  });

  // Собираем все tmdbId для запроса CineChance рейтингов
  const allTmdbIds = [
    ...watchListRecords.map(r => r.tmdbId),
    ...blacklistRecords.map(r => r.tmdbId),
  ];

  // Получаем CineChance рейтинги для всех фильмов
  const cineChanceRatings = await fetchCineChanceRatings(allTmdbIds);

  // Обрабатываем WatchList
  const moviesWithStatus = await Promise.all(
    watchListRecords.map(async (record: any) => {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
      
      // Получаем CineChance данные
      const cineChanceData = cineChanceRatings.get(record.tmdbId);
      const cineChanceRating = cineChanceData?.averageRating || null;
      const cineChanceVotes = cineChanceData?.count || 0;

      // Вычисляем combinedRating по той же формуле, что и в MovieCard
      const combinedRating = calculateCineChanceScore({
        tmdbRating: tmdbData?.vote_average || 0,
        tmdbVotes: tmdbData?.vote_count || 0,
        cineChanceRating,
        cineChanceVotes,
      });

      return {
        id: record.tmdbId,
        media_type: record.mediaType as 'movie' | 'tv',
        title: record.title,
        name: record.title,
        poster_path: tmdbData?.poster_path || null,
        vote_average: tmdbData?.vote_average || 0,
        vote_count: tmdbData?.vote_count || 0,
        release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        overview: tmdbData?.overview || '',
        statusName: record.status.name,
        // TMDB details возвращает genres как массив объектов, конвертируем в genre_ids
        genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
        original_language: tmdbData?.original_language || '',
        // Combined Rating для сортировки
        combinedRating,
        // Дата добавления для сортировки
        addedAt: record.addedAt?.toISOString() || '',
        // Моя оценка
        userRating: record.userRating,
      };
    })
  );

  // Обрабатываем Blacklist
  const hiddenMovies = await Promise.all(
    blacklistRecords.map(async (record: any) => {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
      
      // Получаем CineChance данные
      const cineChanceData = cineChanceRatings.get(record.tmdbId);
      const cineChanceRating = cineChanceData?.averageRating || null;
      const cineChanceVotes = cineChanceData?.count || 0;

      // Вычисляем combinedRating
      const combinedRating = calculateCineChanceScore({
        tmdbRating: tmdbData?.vote_average || 0,
        tmdbVotes: tmdbData?.vote_count || 0,
        cineChanceRating,
        cineChanceVotes,
      });

      return {
        id: record.tmdbId,
        media_type: record.mediaType as 'movie' | 'tv',
        // Для черного списка берем название из TMDB, так как в БЛ мы его не храним
        title: tmdbData?.title || tmdbData?.name || 'Без названия',
        name: tmdbData?.title || tmdbData?.name || 'Без названия',
        poster_path: tmdbData?.poster_path || null,
        vote_average: tmdbData?.vote_average || 0,
        vote_count: tmdbData?.vote_count || 0,
        release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        overview: tmdbData?.overview || '',
        // TMDB details возвращает genres как массив объектов, конвертируем в genre_ids
        genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
        original_language: tmdbData?.original_language || '',
        // Combined Rating для сортировки
        combinedRating,
        // Дата добавления для сортировки (используем createdAt для blacklist)
        addedAt: record.createdAt?.toISOString() || '',
        // Моя оценка (может отсутствовать в blacklist)
        userRating: null,
      };
    })
  );

  // Группируем WatchList
  const grouped = {
    watched: moviesWithStatus.filter(m => m.statusName === 'Просмотрено'),
    wantToWatch: moviesWithStatus.filter(m => m.statusName === 'Хочу посмотреть'),
    dropped: moviesWithStatus.filter(m => m.statusName === 'Брошено'),
  };

  return (
    <MyMoviesClient
      watched={grouped.watched}
      wantToWatch={grouped.wantToWatch}
      dropped={grouped.dropped}
      hidden={hiddenMovies}
    />
  );
}
