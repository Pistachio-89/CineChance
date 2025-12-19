'use client';

import { useState } from 'react';
import MovieCard from '../components/MovieCard';
import { Movie } from '@/lib/tmdb';

export default function MyMoviesClient({
  initialMovies,
}: {
  initialMovies: Movie[];
}) {
  const [activeTab, setActiveTab] = useState<
    'watched' | 'wantToWatch' | 'dropped'
  >('watched');

  const tabs = [
    { id: 'watched' as const, label: 'Просмотрено', count: initialMovies.length },
    { id: 'wantToWatch' as const, label: 'Хочу посмотреть', count: 0 },
    { id: 'dropped' as const, label: 'Брошено', count: 0 },
  ];

  const currentMovies = activeTab === 'watched' ? initialMovies : [];

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">
          Мои фильмы
        </h1>

        {/* Вкладки */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-gray-800 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              <span className="font-medium">{tab.label}</span>
              <span className="ml-2 text-sm">({tab.count})</span>
            </button>
          ))}
        </div>

        {currentMovies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {currentMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            В этом списке пока ничего нет
          </div>
        )}
      </div>
    </div>
  );
}
