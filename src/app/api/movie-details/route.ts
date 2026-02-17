// src/app/api/movie-details/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/movie-details');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = parseInt(searchParams.get('tmdbId') || '0');
    const mediaType = searchParams.get('mediaType');

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Сначала проверяем, есть ли детали в кэше в нашей базе
    // Для простоты делаем прямой запрос к TMDB API
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU&append_to_response=credits,keywords`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 500 });
    }

    const data = await res.json();

    // Получаем страны производства (первые 2 для компактности)
    const productionCountries = data.production_countries
      ?.slice(0, 2)
      ?.map((c: any) => c.iso_3166_1 === 'US' ? 'США' : c.name)
      || [];

    // Для сериалов - количество сезонов
    const seasonNumber = mediaType === 'tv' && data.number_of_seasons
      ? `${data.number_of_seasons} ${getSeasonWord(data.number_of_seasons)}`
      : null;

    // Проверяем, является ли контент аниме (по keyword "anime" ID 210024)
    // Ключевые слова уже получены в первом запросе
    let isAnime = false;
    try {
      const keywords = data.keywords?.keywords || data.keywords?.results || [];
      isAnime = keywords.some((k: any) => k.id === 210024 || k.name?.toLowerCase() === 'anime');
    } catch (kwError) {
      logger.warn('Failed to check keywords for anime detection', { 
        error: kwError instanceof Error ? kwError.message : String(kwError),
        context: 'MovieDetails'
      });
    }

    // Получаем первых 5 актеров из cast
    const cast = data.credits?.cast
      ?.slice(0, 5)
      ?.map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      })) || [];

    return NextResponse.json({
      genres: data.genres?.map((g: any) => g.name) || [],
      runtime: data.runtime || data.episode_run_time?.[0] || 0,
      adult: data.adult || false,
      productionCountries,
      seasonNumber,
      isAnime,
      collectionName: data.belongs_to_collection?.name || null,
      collectionId: data.belongs_to_collection?.id || null,
      cast,
    });
  } catch (error) {
    logger.error('Movie details error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'MovieDetails'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function getSeasonWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return 'сезонов';
  }
  if (mod10 === 1) {
    return 'сезон';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'сезона';
  }
  return 'сезонов';
}
