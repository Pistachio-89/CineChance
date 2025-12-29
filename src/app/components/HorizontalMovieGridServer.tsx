// src/app/components/HorizontalMovieGridServer.tsx
import { fetchTrendingMovies } from '@/lib/tmdb';
import MovieCard from './MovieCard';
import './ScrollContainer.css';
import ScrollContainer from './ScrollContainer';

// Интерфейс для входящих пропсов
interface Props {
  blacklistedIds?: Set<number>;
}

export default async function HorizontalMovieGridServer({ blacklistedIds = new Set() }: Props) {
  try {
    const movies = await fetchTrendingMovies('week');
    
    // Фильтруем список: убираем фильмы, ID которых есть в черном списке
    const filteredMovies = movies.filter(movie => !blacklistedIds.has(movie.id));
    const displayMovies = filteredMovies.slice(0, 20);

    if (displayMovies.length === 0) {
      return (
        <div className="w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 mt-4">Популярное на этой неделе</h1>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
            <p className="text-yellow-300">Не удалось загрузить фильмы. Возможные причины:</p>
            <ul className="text-gray-400 text-sm mt-2 list-disc pl-5">
              <li>Проблемы с API ключом TMDB</li>
              <li>Ограничения API (лимит запросов)</li>
              <li>Временно недоступен сервер TMDB</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 mt-4">Популярное на этой неделе</h1>
        
        {/* Используем компонент ScrollContainer */}
        <ScrollContainer>
          {displayMovies.map((movie, index) => (
            <div key={movie.id} className="flex-shrink-0 w-48">
              <MovieCard movie={movie} priority={index < 4} />
            </div>
          ))}
        </ScrollContainer>
      </div>
    );
  } catch (error) {
    console.error('Ошибка в компоненте HorizontalMovieGridServer:', error);
    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 mt-4">Популярное на этой неделе</h1>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6">
          <p className="text-red-300">Критическая ошибка при загрузке фильмов</p>
          <p className="text-gray-400 text-sm mt-2">Пожалуйста, проверьте консоль для подробностей.</p>
        </div>
      </div>
    );
  }
}