// src/lib/tmdb.ts
export interface Media {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  genre_ids?: number[];
  original_language?: string;
}

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// Убедитесь, что ключ загружен (для отладки)
if (!TMDB_API_KEY) {
  console.warn('⚠️ TMDB_API_KEY не найден! Проверьте .env.local');
}

export const fetchTrendingMovies = async (timeWindow: 'day' | 'week' = 'week'): Promise<Media[]> => {
  try {
    // Формируем URL с API ключом как параметр запроса
    const url = new URL(`${BASE_URL}/trending/movie/${timeWindow}`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');
    
    const response = await fetch(url.toString(), {
      headers: {
        'accept': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка TMDB API:', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    // Преобразуем фильмы в общий формат Media
    const movies: Media[] = (data.results || []).map((item: any) => ({
      id: item.id,
      media_type: 'movie',
      title: item.title,
      name: item.title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      vote_count: item.vote_count,
      release_date: item.release_date,
      first_air_date: item.release_date,
      overview: item.overview,
    }));
    
    return movies;
  } catch (error) {
    console.error('❌ Сетевая ошибка при запросе к TMDB:', error);
    return [];
  }
};

export const fetchPopularMovies = async (page: number = 1): Promise<Media[]> => {
  try {
    const url = new URL(`${BASE_URL}/movie/popular`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');
    url.searchParams.append('page', page.toString());
    
    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка TMDB API (popular):', response.status, errorText);
      return [];
    }
    
    const data = await response.json();
    // Преобразуем фильмы в общий формат Media
    const movies: Media[] = (data.results || []).map((item: any) => ({
      id: item.id,
      media_type: 'movie',
      title: item.title,
      name: item.title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      vote_count: item.vote_count,
      release_date: item.release_date,
      first_air_date: item.release_date,
      overview: item.overview,
    }));
    
    return movies;
  } catch (error) {
    console.error('❌ Ошибка при запросе популярных фильмов:', error);
    return [];
  }
};

export const searchMedia = async (query: string, page: number = 1): Promise<Media[]> => {
  if (!query.trim()) return [];

  try {
    const url = new URL(`${BASE_URL}/search/multi`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('query', query.trim());
    url.searchParams.append('language', 'ru-RU');
    url.searchParams.append('page', page.toString());

    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error('Ошибка TMDB search:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Фильтруем только фильмы и сериалы
    const filteredResults = (data.results || []).filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );
    
    // Преобразуем в общий формат Media
    const media: Media[] = filteredResults.map((item: any) => ({
      id: item.id,
      media_type: item.media_type,
      title: item.title || item.name || 'Без названия',
      name: item.name || item.title || 'Без названия',
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      vote_count: item.vote_count,
      release_date: item.release_date || item.first_air_date,
      first_air_date: item.first_air_date || item.release_date,
      overview: item.overview,
      genre_ids: item.genre_ids,
      original_language: item.original_language,
    }));

    return media.slice(0, 100); // Ограничиваем 100 результатами
  } catch (error) {
    console.error('Ошибка при поиске:', error);
    return [];
  }
};

// Интерфейс для расширенных данных о фильме
export interface MovieDetails {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string | null;
  first_air_date?: string | null;
  overview: string;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  original_language?: string;
}

// Получение деталей конкретного фильма/сериала
export const fetchMediaDetails = async (
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<MovieDetails | null> => {
  try {
    const url = new URL(`${BASE_URL}/${mediaType}/${tmdbId}`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');
    url.searchParams.append('append_to_response', 'credits');

    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400 }, // Кэшируем на 24 часа
    });

    if (!response.ok) {
      console.error('Ошибка TMDB details:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      id: data.id,
      title: data.title,
      name: data.name,
      poster_path: data.poster_path,
      vote_average: data.vote_average || 0,
      vote_count: data.vote_count || 0,
      release_date: data.release_date,
      first_air_date: data.first_air_date,
      overview: data.overview || '',
      runtime: data.runtime,
      episode_run_time: data.episode_run_time,
      genres: data.genres || [],
      original_language: data.original_language,
    };
  } catch (error) {
    console.error('Ошибка при получении деталей:', error);
    return null;
  }
};
