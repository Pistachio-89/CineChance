// src/app/api/collection/[id]/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { success } = await rateLimit(req, 'default');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const { id } = await params;
    const collectionId = parseInt(id);

    if (!collectionId) {
      return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    const res = await fetch(
      `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}&language=ru-RU`,
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 500 });
    }

    const data = await res.json();

    // Получаем сессию пользователя
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Получаем все blacklist IDs пользователя одним запросом
    let blacklistedIds: Set<number> = new Set();
    if (userId) {
      const blacklist = await prisma.blacklist.findMany({
        where: { userId },
        select: { tmdbId: true }
      });
      blacklistedIds = new Set(blacklist.map(b => b.tmdbId));
    }

    // Получаем все watchlist статусы пользователя одним запросом
    // Оптимизировано: используем select вместо include
    let watchlistMap: Map<string, { status: string | null; userRating: number | null }> = new Map();
    if (userId) {
      const watchlist = await prisma.watchList.findMany({
        where: { userId },
        select: {
          tmdbId: true,
          mediaType: true,
          status: { select: { name: true } },
          userRating: true,
          weightedRating: true, // Добавляем взвешенную оценку
        }
      });
      watchlist.forEach((item) => {
        watchlistMap.set(`${item.mediaType}_${item.tmdbId}`, { 
          status: item.status?.name || null, 
          userRating: item.weightedRating ?? item.userRating // Используем взвешенную оценку
        });
      });
    }

    // Формируем данные о фильмах
    const moviesWithStatus = (data.parts || []).map((movie: any) => {
      const watchlistKey = `movie_${movie.id}`;
      const watchlistData = watchlistMap.get(watchlistKey);
      const isBlacklisted = blacklistedIds.has(movie.id);

      const movieData: any = {
        id: movie.id,
        media_type: 'movie',
        title: movie.title,
        name: movie.title,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        release_date: movie.release_date,
        first_air_date: movie.release_date,
        overview: movie.overview,
        isBlacklisted,
      };

      // Добавляем status и userRating только если фильм в watchlist
      if (watchlistData) {
        movieData.status = watchlistData.status;
        movieData.userRating = watchlistData.userRating;
      }

      return movieData;
    });

    return NextResponse.json({
      id: data.id,
      name: data.name,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path,
      parts: moviesWithStatus,
    });
  } catch (error) {
    logger.error('Collection error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Collection'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
