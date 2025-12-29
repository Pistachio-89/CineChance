// src/app/my-movies/MyMoviesClient.tsx
'use client';

import { useState } from 'react';
import MovieCard from '../components/MovieCard';
import { Media } from '@/lib/tmdb';

interface MyMoviesClientProps {
  watched: (Media & { statusName: string })[];
  wantToWatch: (Media & { statusName: string })[];
  dropped: (Media & { statusName: string })[];
  hidden: Media[]; // Добавляем проп
}

export default function MyMoviesClient({
  watched,
  wantToWatch,
  dropped,
  hidden,
}: MyMoviesClientProps) {
  const [activeTab, setActiveTab] = useState<'watched' | 'wantToWatch' | 'dropped' | 'hidden'>('watched');

  const tabs = [
    { id: 'watched' as const, label: 'Просмотрено', count: watched.length },
    { id: 'wantToWatch' as const, label: 'Хочу посмотреть', count: wantToWatch.length },
    { id: 'dropped' as const, label: 'Брошено', count: dropped.length },
    { 
      id: 'hidden' as const, 
      label: 'Скрытые', 
      count: hidden.length,
      // Серый, едва заметный цвет
      className: 'text-gray-500 hover:text-gray-400' 
    },
  ];

  const tabData = {
    watched,
    wantToWatch,
    dropped,
    hidden,
  };

  const currentMovies = tabData[activeTab];
  const isRestoreView = activeTab === 'hidden'; // Флаг режима восстановления

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">
          Мои фильмы
        </h1>

        {/* Вкладки */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-gray-800 pb-2">
          {tabs.map((tab) => {
            // Базовые стили
            let baseClasses = "pb-3 px-2 border-b-2 transition-colors relative cursor-pointer ";
            // Если активная вкладка
            if (activeTab === tab.id) {
              baseClasses += "border-blue-500 text-white";
            } else {
              // Если неактивная
              baseClasses += "border-transparent hover:border-gray-600 ";
              // Применяем кастомный класс цвета (если есть для Скрытых) или стандартный серый
              baseClasses += tab.className || "text-gray-400 hover:text-white";
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={baseClasses}
              >
                <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                <span className="ml-2 text-xs sm:text-sm">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Сетка фильмов */}
        {currentMovies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {currentMovies.map((movie, index) => (
              <div key={movie.id} className="p-1">
                {/* Передаем флаг restoreView */}
                <MovieCard movie={movie} restoreView={isRestoreView} showRatingBadge priority={index < 6} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">
              В этом списке пока ничего нет
            </p>
            <p className="text-gray-500 text-sm mt-4">
              {isRestoreView ? 'Добавляйте фильмы в черный список на главной странице' : 'Добавляйте фильмы с главной страницы или поиска'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}