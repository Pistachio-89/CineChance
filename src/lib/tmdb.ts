// src/app/lib/tmdb.ts
export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  overview: string;
}

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchTrendingMovies = async (timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> => {
  try {
    const url = new URL(`${BASE_URL}/trending/movie/${timeWindow}`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');
    
    const response = await fetch(url.toString(), {
      headers: {
        'accept': 'application/json',
      },
      // Кэшируем на 1 час
      next: { revalidate: 3600 }
    });
    
    if (!response.ok) {
      console.error('TMDB API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Ошибка при запросе к TMDB:', error);
    return [];
  }
};

// Остальные функции остаются...