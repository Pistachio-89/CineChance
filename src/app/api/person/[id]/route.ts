// src/app/api/person/[id]/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const personId = parseInt(id);
    
    if (!personId) {
      return NextResponse.json({ error: 'Missing person ID' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    // Получаем информацию об актере
    const personRes = await fetch(
      `https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&language=ru-RU`
    );

    if (!personRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch person' }, { status: 500 });
    }

    const personData = await personRes.json();

    // Получаем фильмографию актера
    const creditsRes = await fetch(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}&language=ru-RU`
    );

    if (!creditsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    const creditsData = await creditsRes.json();

    // Фильтруем и сортируем фильмографию
    const seen = new Set<string>();
    const filmography = creditsData.cast
      ?.filter((item: any) => {
        // Только с постером
        if (!item.poster_path) return false;
        
        // Удаляем дубликаты (один и тот же id + media_type)
        const key = `${item.media_type}_${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      ?.sort((a: any, b: any) => {
        // Сначала сортируем по популярности, затем по дате
        if (b.popularity !== a.popularity) {
          return b.popularity - a.popularity;
        }
        // Для фильмов по дате выхода (новые сначала)
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        return dateB.localeCompare(dateA);
      })
      ?.map((item: any) => ({
        id: item.id,
        media_type: item.media_type,
        title: item.title || item.name,
        name: item.title || item.name,
        poster_path: item.poster_path,
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        release_date: item.release_date || item.first_air_date || '',
        overview: item.overview || '',
        character: item.character || '',
        popularity: item.popularity || 0,
      })) || [];

    return NextResponse.json({
      id: personData.id,
      name: personData.name,
      biography: personData.biography,
      profile_path: personData.profile_path,
      birthday: personData.birthday,
      deathday: personData.deathday,
      place_of_birth: personData.place_of_birth,
      known_for_department: personData.known_for_department,
      filmography,
    });
  } catch (error) {
    logger.error('Person API error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Person'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
