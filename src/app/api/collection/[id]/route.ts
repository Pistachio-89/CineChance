// src/app/api/collection/[id]/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}&language=ru-RU`
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 500 });
    }

    const data = await res.json();

    // Получаем данные о статусе и blacklist для каждого фильма
    const moviesWithStatus = await Promise.all(
      (data.parts || []).map(async (movie: any) => {
        let status = null;
        let userRating = null;
        let isBlacklisted = false;

        try {
          // Получаем статус из watchlist
          const statusRes = await fetch(
            `/api/watchlist?tmdbId=${movie.id}&mediaType=movie`
          );
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            status = statusData.status;
            userRating = statusData.userRating;
          }

          // Получаем статус blacklist
          const blacklistRes = await fetch(
            `/api/blacklist?tmdbId=${movie.id}&mediaType=movie`
          );
          if (blacklistRes.ok) {
            const blacklistData = await blacklistRes.json();
            isBlacklisted = blacklistData.isBlacklisted;
          }
        } catch (error) {
          logger.error('Error fetching status for movie', { 
            movieId: movie.id,
            error: error instanceof Error ? error.message : String(error),
            context: 'Collection'
          });
        }

        // Формируем базовый объект
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

        // Добавляем status и userRating только если они существуют
        // Это важно для MovieCard, который проверяет initialStatus === undefined
        if (status) {
          movieData.status = status;
        }
        if (userRating !== null && userRating !== undefined) {
          movieData.userRating = userRating;
        }

        return movieData;
      })
    );

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
