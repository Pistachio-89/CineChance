// src/app/recommendations/RecommendationActions.tsx
'use client';

import { useState } from 'react';
import { logger } from '@/lib/logger';

interface MovieData {
  id: number;
  media_type: 'movie' | 'tv' | 'anime';
  title: string;
  name: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string | null;
  first_air_date: string | null;
  overview: string;
  runtime: number;
  genres: { id: number; name: string }[];
  genre_ids?: number[];
  original_language?: string;
  production_countries?: { name: string }[];
  cast?: { id: number; name: string; character: string; profilePath: string | null }[];
  crew?: { id: number; name: string; job: string; department: string; profilePath: string | null }[];
}

interface RecommendationActionsProps {
  movie: MovieData;
  onAddToWatchlist: (movie: MovieData) => Promise<void>;
  onRateMovie: (movie: MovieData, rating: number) => Promise<void>;
  onMarkAsWatched: (movie: MovieData) => Promise<void>;
  onSkipMovie: (movie: MovieData) => Promise<void>;
  onGetSimilar: (movie: MovieData) => Promise<void>;
  onGetRecommendations: (movie: MovieData) => Promise<void>;
  onTrackEvent: (eventType: string, data: any) => void;
  onTrackSignal: (signalType: string, data: any) => void;
}

export default function RecommendationActions({
  movie,
  onAddToWatchlist,
  onRateMovie,
  onMarkAsWatched,
  onSkipMovie,
  onGetSimilar,
  onGetRecommendations,
  onTrackEvent,
  onTrackSignal,
}: RecommendationActionsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (action: string, handler: () => Promise<void>) => {
    setIsLoading(action);
    try {
      await handler();
      onTrackEvent(`recommendation_${action}`, { movieId: movie.id, movieTitle: movie.title });
    } catch (error) {
      logger.error(`Action failed: ${action}`, { movieId: movie.id, action, error });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button
        onClick={() => handleAction('add_to_watchlist', () => onAddToWatchlist(movie))}
        disabled={isLoading !== null}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading === 'add_to_watchlist' ? 'Добавление...' : 'В список'}
      </button>

      <button
        onClick={() => handleAction('mark_watched', () => onMarkAsWatched(movie))}
        disabled={isLoading !== null}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
      >
        {isLoading === 'mark_watched' ? 'Отмечаю...' : 'Просмотрено'}
      </button>

      <button
        onClick={() => handleAction('skip', () => onSkipMovie(movie))}
        disabled={isLoading !== null}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {isLoading === 'skip' ? 'Пропускаю...' : 'Пропустить'}
      </button>

      <button
        onClick={() => handleAction('similar', () => onGetSimilar(movie))}
        disabled={isLoading !== null}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {isLoading === 'similar' ? 'Ищу...' : 'Похожие'}
      </button>

      <button
        onClick={() => handleAction('recommendations', () => onGetRecommendations(movie))}
        disabled={isLoading !== null}
        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
      >
        {isLoading === 'recommendations' ? 'Генерирую...' : 'Рекомендации'}
      </button>
    </div>
  );
}