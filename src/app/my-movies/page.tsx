// src/app/my-movies/page.tsx
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma'; 
import MyMoviesClient from './MyMoviesClient';
import { Media } from '@/lib/tmdb';

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

  // Обрабатываем WatchList
  const moviesWithStatus = await Promise.all(
    watchListRecords.map(async (record: any) => {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
      return {
        id: record.tmdbId,
        media_type: record.mediaType as 'movie' | 'tv',
        title: record.title,
        name: record.title,
        poster_path: tmdbData?.poster_path || null,
        vote_average: record.voteAverage || tmdbData?.vote_average || 0,
        vote_count: tmdbData?.vote_count || 0,
        release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        overview: tmdbData?.overview || '',
        statusName: record.status.name,
      };
    })
  );

  // Обрабатываем Blacklist
  const hiddenMovies = await Promise.all(
    blacklistRecords.map(async (record: any) => {
      const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType);
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
      hidden={hiddenMovies} // Передаем скрытые фильмы
    />
  );
}
