// src/app/components/MovieGridServer.tsx
import MovieCard from './MovieCard';
import { fetchTrendingMovies } from '@/lib/tmdb';

export default async function MovieGridServer() {
  try {
    const movies = await fetchTrendingMovies('week');
    const displayMovies = movies.slice(0, 28);

    if (displayMovies.length === 0) {
      return (
        <div className="w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Не удалось загрузить фильмы. Попробуйте позже.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
          {displayMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in MovieGridServer:', error);
    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
        <div className="text-center py-12">
          <p className="text-red-400 text-lg">Ошибка при загрузке фильмов</p>
        </div>
      </div>
    );
  }
}