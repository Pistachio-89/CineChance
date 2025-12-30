// src/app/my-movies/MyMoviesClient.tsx
'use client';

import { useState, useMemo } from 'react';
import MovieCard from '../components/MovieCard';
import FilmFilters, { FilmFilterState, SortState, AdditionalFilters } from './FilmFilters';
import { Media } from '@/lib/tmdb';

interface MovieWithStatus extends Media {
  statusName?: string;
  isBlacklisted?: boolean;
  combinedRating?: number;
  addedAt?: string;
  userRating?: number | null;
}

interface MyMoviesClientProps {
  watched: MovieWithStatus[];
  wantToWatch: MovieWithStatus[];
  dropped: MovieWithStatus[];
  hidden: MovieWithStatus[];
}

export default function MyMoviesClient({
  watched,
  wantToWatch,
  dropped,
  hidden,
}: MyMoviesClientProps) {
  const [activeTab, setActiveTab] = useState<'watched' | 'wantToWatch' | 'dropped' | 'hidden'>('watched');
  const [filmFilters, setFilmFilters] = useState<FilmFilterState>({
    showMovies: true,
    showTv: true,
    showAnime: true,
  });
  const [sort, setSort] = useState<SortState>({
    sortBy: 'rating',
    sortOrder: 'desc',
  });
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>({
    minRating: 0,
    maxRating: 10,
    yearFrom: '',
    yearTo: '',
  });
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  // Функция определения аниме по жанру и языку (быстрая проверка)
  const isAnimeQuick = (movie: MovieWithStatus): boolean => {
    // Жанр 16 - Animation, оригинальный язык - японский
    const hasAnimeGenre = movie.genre_ids?.includes(16) ?? false;
    return hasAnimeGenre && movie.original_language === 'ja';
  };

  // Функция фильтрации списка фильмов
  const filterMovies = (movies: MovieWithStatus[]): MovieWithStatus[] => {
    return movies.filter(movie => {
      // Определяем тип контента
      const isAnime = isAnimeQuick(movie);
      
      // Фильтр по типу контента
      if (isAnime) {
        if (!filmFilters.showAnime) return false;
      } else if (movie.media_type === 'movie') {
        if (!filmFilters.showMovies) return false;
      } else if (movie.media_type === 'tv') {
        if (!filmFilters.showTv) return false;
      }
      
      // Фильтр по году выпуска
      const releaseYear = (movie.release_date || movie.first_air_date || '').split('-')[0];
      if (additionalFilters.yearFrom && parseInt(releaseYear) < parseInt(additionalFilters.yearFrom)) {
        return false;
      }
      if (additionalFilters.yearTo && parseInt(releaseYear) > parseInt(additionalFilters.yearTo)) {
        return false;
      }
      
      // Фильтр по моей оценке
      const userRating = movie.userRating ?? 0;
      if (userRating < additionalFilters.minRating || userRating > additionalFilters.maxRating) {
        return false;
      }
      
      // Фильтр по жанрам
      if (selectedGenres.length > 0) {
        if (!movie.genre_ids) {
          return false;
        }
        const hasMatchingGenre = selectedGenres.some(genreId => movie.genre_ids!.includes(genreId));
        if (!hasMatchingGenre) return false;
      }
      
      return true;
    });
  };

  // Функция сортировки
  const sortMovies = (movies: MovieWithStatus[], sortState: SortState): MovieWithStatus[] => {
    return [...movies].sort((a, b) => {
      let comparison = 0;
      
      switch (sortState.sortBy) {
        case 'popularity':
          comparison = b.vote_count - a.vote_count;
          break;
        case 'rating':
          // Используем Combined Rating для сортировки по рейтингу
          const ratingA = a.combinedRating ?? a.vote_average;
          const ratingB = b.combinedRating ?? b.vote_average;
          comparison = ratingB - ratingA;
          break;
        case 'date':
          const dateA = a.release_date || a.first_air_date || '';
          const dateB = b.release_date || b.first_air_date || '';
          comparison = dateB.localeCompare(dateA);
          break;
        case 'savedDate':
          // Сортировка по дате добавления в список
          const savedA = a.addedAt || '';
          const savedB = b.addedAt || '';
          comparison = savedB.localeCompare(savedA);
          break;
      }
      
      return sortState.sortOrder === 'desc' ? comparison : -comparison;
    });
  };

  // Фильтруем и сортируем все списки
  const filteredWatched = useMemo(() => {
    const filtered = filterMovies(watched);
    return sortMovies(filtered, sort);
  }, [watched, filmFilters, sort, additionalFilters, selectedGenres]);
  
  const filteredWantToWatch = useMemo(() => {
    const filtered = filterMovies(wantToWatch);
    return sortMovies(filtered, sort);
  }, [wantToWatch, filmFilters, sort, additionalFilters, selectedGenres]);
  
  const filteredDropped = useMemo(() => {
    const filtered = filterMovies(dropped);
    return sortMovies(filtered, sort);
  }, [dropped, filmFilters, sort, additionalFilters, selectedGenres]);
  
  const filteredHidden = useMemo(() => {
    const filtered = filterMovies(hidden);
    return sortMovies(filtered, sort);
  }, [hidden, filmFilters, sort, additionalFilters, selectedGenres]);

  // Данные для вкладок с учётом фильтров
  const tabs = [
    { id: 'watched' as const, label: 'Просмотрено', count: filteredWatched.length },
    { id: 'wantToWatch' as const, label: 'Хочу посмотреть', count: filteredWantToWatch.length },
    { id: 'dropped' as const, label: 'Брошено', count: filteredDropped.length },
    { 
      id: 'hidden' as const, 
      label: 'Скрытые', 
      count: filteredHidden.length,
      // Серый, едва заметный цвет
      className: 'text-gray-500 hover:text-gray-400' 
    },
  ];

  const tabData: Record<string, MovieWithStatus[]> = {
    watched: filteredWatched,
    wantToWatch: filteredWantToWatch,
    dropped: filteredDropped,
    hidden: filteredHidden,
  };

  const currentMovies = tabData[activeTab];
  const isRestoreView = activeTab === 'hidden'; // Флаг режима восстановления

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Мои фильмы
        </h1>

        {/* Фильтры типов контента и сортировка */}
        <FilmFilters 
          onFiltersChange={setFilmFilters} 
          onSortChange={setSort}
          onAdditionalFiltersChange={(filters, genres) => {
            setAdditionalFilters(filters);
            setSelectedGenres(genres);
          }}
        />

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
                {/* MovieCard сам загрузит статус и isBlacklisted из API */}
                <MovieCard 
                  movie={movie} 
                  restoreView={isRestoreView}
                  showRatingBadge 
                  priority={index < 6} 
                />
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