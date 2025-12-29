// src/app/api/movie-details/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
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

    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`
    );

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

    return NextResponse.json({
      genres: data.genres?.map((g: any) => g.name) || [],
      runtime: data.runtime || data.episode_run_time?.[0] || 0,
      adult: data.adult || false,
      productionCountries,
      seasonNumber,
    });
  } catch (error) {
    console.error('Movie details error:', error);
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
