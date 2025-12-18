'use client';

import { useEffect, useState } from 'react';
import MovieCard from './MovieCard';
import { fetchTrendingMovies, Movie } from '@/lib/tmdb';

export default function MovieGrid() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMovies = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ВАРИАНТ 2: Трендовые фильмы за неделю (рекомендуется)
        const data = await fetchTrendingMovies('week');
        
        if (data && Array.isArray(data)) {
          setMovies(data.slice(0, 28)); // Ограничиваем 28 фильмами
        } else {
          setError('Неверный формат данных от сервера');
          setMovies([]);
        }
      } catch (err) {
        console.error('Ошибка загрузки фильмов:', err);
        setError(`Ошибка загрузки: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  if (loading) {
    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-300 mb-4">{error}</p>
          <p className="text-gray-400 text-sm mb-4">
            Используются демо-данные. Проверьте API ключ в .env.local
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded-lg transition"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
      
      {movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Фильмы не найдены</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg transition"
          >
            Обновить
          </button>
        </div>
      )}
    </div>
  );
}