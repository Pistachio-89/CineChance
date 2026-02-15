// src/app/api/person/[id]/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { success } = await rateLimit(request, 'default');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
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
    const personController = new AbortController();
    const personTimeoutId = setTimeout(() => personController.abort(), 15000);
    
    const personRes = await fetch(
      `https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&language=ru-RU`,
      { 
        next: { revalidate: 86400 },
        signal: personController.signal
      }
    );
    
    clearTimeout(personTimeoutId);

    if (!personRes.ok) {
      const status = personRes.status;
      if (status === 404) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to fetch person (${status})` }, { status: 500 });
    }

    const personData = await personRes.json();

    // Получаем фильмографию актера
    const creditsController = new AbortController();
    const creditsTimeoutId = setTimeout(() => creditsController.abort(), 15000);
    
    const creditsRes = await fetch(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}&language=ru-RU`,
      { 
        next: { revalidate: 86400 },
        signal: creditsController.signal
      }
    );
    
    clearTimeout(creditsTimeoutId);

    if (!creditsRes.ok) {
      // Если не удалось получить фильмографию, возвращаем данные актера без неё
      return NextResponse.json({
        id: personData.id,
        name: personData.name,
        biography: personData.biography,
        profile_path: personData.profile_path,
        birthday: personData.birthday,
        deathday: personData.deathday,
        place_of_birth: personData.place_of_birth,
        known_for_department: personData.known_for_department,
        filmography: [],
        error: 'Filmography unavailable'
      });
    }

    const creditsData = await creditsRes.json();

    // Фильтруем и сортируем фильмографию (включая cast и crew)
    const seen = new Set<string>();
    
    // Объединяем cast и crew
    const allCredits = [
      ...(creditsData.cast || []).map((item: any) => ({ ...item, role_type: 'cast' })),
      ...(creditsData.crew || []).map((item: any) => ({ ...item, role_type: 'crew' }))
    ];
    
    const filmography = allCredits
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
        job: item.job || '', // Должность для crew (режиссер, продюсер и т.д.)
        department: item.department || '', // Отдел для crew
        role_type: item.role_type,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAbort = errorMessage.includes('abort') || errorMessage.includes('timed out');
    
    // Не логируем таймауты - это ожидаемое поведение при проблемах с сетью
    if (!isAbort) {
      logger.error('Person API error', { 
        error: errorMessage,
        context: 'Person'
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch person data' }, { status: 500 });
  }
}
