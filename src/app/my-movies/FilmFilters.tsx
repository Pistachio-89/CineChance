// src/app/my-movies/FilmFilters.tsx
'use client';

import { useState } from 'react';
import TagCloudFilter from './TagCloudFilter';

interface FilmFiltersProps {
  onFiltersChange: (filters: FilmFilterState) => void;
  onSortChange?: (sort: SortState) => void;
  onAdditionalFiltersChange?: (filters: AdditionalFilters, genres: number[]) => void;
  availableGenres?: { id: number; name: string }[];
  userTags?: Array<{ id: string; name: string; count: number }>;
  hideRatingFilter?: boolean;
  hideTagsFilter?: boolean;
  hideGenresFilter?: boolean;
}

export interface FilmFilterState {
  showMovies: boolean;
  showTv: boolean;
  showAnime: boolean;
}

export interface SortState {
  sortBy: 'popularity' | 'rating' | 'date' | 'savedDate';
  sortOrder: 'desc' | 'asc';
}

export interface AdditionalFilters {
  minRating: number;
  maxRating: number;
  yearFrom: string;
  yearTo: string;
  selectedTags?: string[];
}

const defaultFilters: FilmFilterState = {
  showMovies: true,
  showTv: true,
  showAnime: true,
};

const defaultSort: SortState = {
  sortBy: 'rating',
  sortOrder: 'desc',
};

const defaultAdditionalFilters: AdditionalFilters = {
  minRating: 0,
  maxRating: 10,
  yearFrom: '',
  yearTo: '',
};

export default function FilmFilters({ 
  onFiltersChange, 
  onSortChange, 
  onAdditionalFiltersChange,
  availableGenres = [],
  userTags = [],
  hideRatingFilter = false,
  hideTagsFilter = false,
  hideGenresFilter = false,
}: FilmFiltersProps) {
  const [filters, setFilters] = useState<FilmFilterState>(defaultFilters);
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [isExpanded, setIsExpanded] = useState(false);
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(defaultAdditionalFilters);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleFilter = (key: keyof FilmFilterState) => {
    const newFilters = { ...filters, [key]: !filters[key] };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSortChange = (key: keyof SortState, value: string) => {
    const newSort = { ...sort, [key]: value as any };
    setSort(newSort);
    if (onSortChange) {
      onSortChange(newSort);
    }
  };

  const toggleGenre = (genreId: number) => {
    const newGenres = selectedGenres.includes(genreId)
      ? selectedGenres.filter(id => id !== genreId)
      : [...selectedGenres, genreId];
    setSelectedGenres(newGenres);
    if (onAdditionalFiltersChange) {
      onAdditionalFiltersChange(additionalFilters, newGenres);
    }
  };

  const resetAdditionalFilters = () => {
    setAdditionalFilters(defaultAdditionalFilters);
    setSelectedGenres([]);
    setSelectedTags([]);
    if (onAdditionalFiltersChange) {
      onAdditionalFiltersChange(defaultAdditionalFilters, []);
    }
  };

  const hasActiveAdditionalFilters = additionalFilters.minRating > 0 ||
    additionalFilters.maxRating < 10 ||
    additionalFilters.yearFrom ||
    additionalFilters.yearTo ||
    selectedGenres.length > 0 ||
    selectedTags.length > 0;

  return (
    <div className="w-full">
      {/* Основные фильтры */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <span className="text-gray-400 text-xs sm:text-sm font-medium mb-1 sm:mb-0 sm:mr-2">Показывать:</span>

        <div className="flex flex-wrap gap-2">
          {/* Кнопка Фильмы */}
          <button
            onClick={() => toggleFilter('showMovies')}
            className={`
              px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
              relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none
              ${filters.showMovies
                ? 'text-white shadow-lg shadow-green-900/30 border-transparent'
                : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }
            `}
            style={{
              background: filters.showMovies
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)'
                : ''
            }}
          >
            <span className="relative z-10">Фильмы</span>
            {filters.showMovies && (
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent"></div>
            )}
          </button>

          {/* Кнопка Сериалы */}
          <button
            onClick={() => toggleFilter('showTv')}
            className={`
              px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
              relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none
              ${filters.showTv
                ? 'text-white shadow-lg shadow-blue-900/30 border-transparent'
                : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }
            `}
            style={{
              background: filters.showTv
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(30, 64, 175, 0.95) 100%)'
                : ''
            }}
          >
            <span className="relative z-10">Сериалы</span>
            {filters.showTv && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent"></div>
            )}
          </button>

          {/* Кнопка Аниме */}
          <button
            onClick={() => toggleFilter('showAnime')}
            className={`
              px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
              relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none
              ${filters.showAnime
                ? 'text-white shadow-lg shadow-purple-900/30 border-transparent'
                : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
              }
            `}
            style={{
              background: filters.showAnime
                ? 'linear-gradient(135deg, rgba(156, 64, 254, 0.95) 0%, rgba(107, 33, 168, 0.95) 100%)'
                : ''
            }}
          >
            <span className="relative z-10">Аниме</span>
            {filters.showAnime && (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent"></div>
            )}
          </button>
        </div>
      </div>

      {/* Блок сортировки и дополнительных фильтров */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          <span className="text-gray-400 text-xs sm:text-sm font-medium mb-1 sm:mb-0 sm:mr-2">Сортировка:</span>
          
          <div className="flex items-center gap-2 w-full">
            <select
              value={sort.sortBy}
              onChange={(e) => handleSortChange('sortBy', e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-750 transition-colors w-full sm:w-[200px]"
            >
              <option value="rating">По рейтингу</option>
              <option value="popularity">По популярности</option>
              <option value="date">По дате выхода</option>
              <option value="savedDate">По дате сохранения</option>
            </select>
            
            <select
              value={sort.sortOrder}
              onChange={(e) => handleSortChange('sortOrder', e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-750 transition-colors w-16"
            >
              <option value="desc">▼</option>
              <option value="asc">▲</option>
            </select>
          </div>
        </div>

        {/* Кнопка Доп. фильтры */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 
            sm:w-auto w-full
            ${hasActiveAdditionalFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          <span className="truncate">Доп. фильтры {hasActiveAdditionalFilters && '•'}</span>
        </button>
      </div>

      {/* Раскрывающаяся панель с дополнительными фильтрами */}
      {isExpanded && (
        <div className="mt-4 bg-gray-900/80 rounded-lg p-4 space-y-4 border border-gray-800">
          {/* Фильтр по году */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">Год выпуска</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="От"
                value={additionalFilters.yearFrom}
                onChange={(e) => {
                  const newFilters = { ...additionalFilters, yearFrom: e.target.value };
                  setAdditionalFilters(newFilters);
                  if (onAdditionalFiltersChange) {
                    onAdditionalFiltersChange(newFilters, selectedGenres);
                  }
                }}
                className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-500">—</span>
              <input
                type="number"
                placeholder="До"
                value={additionalFilters.yearTo}
                onChange={(e) => {
                  const newFilters = { ...additionalFilters, yearTo: e.target.value };
                  setAdditionalFilters(newFilters);
                  if (onAdditionalFiltersChange) {
                    onAdditionalFiltersChange(newFilters, selectedGenres);
                  }
                }}
                className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Фильтр по рейтингу пользователя */}
          {!hideRatingFilter && (
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Моя оценка: {additionalFilters.minRating > 0 || additionalFilters.maxRating < 10 ? `${additionalFilters.minRating} - ${additionalFilters.maxRating}` : 'Любая'}
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <span className="text-xs text-gray-500 block mb-1">От</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={additionalFilters.minRating}
                    onChange={(e) => {
                      const newFilters = { ...additionalFilters, minRating: parseInt(e.target.value) };
                      setAdditionalFilters(newFilters);
                      if (onAdditionalFiltersChange) {
                        onAdditionalFiltersChange(newFilters, selectedGenres);
                      }
                    }}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs text-gray-500 block mb-1">До</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={additionalFilters.maxRating}
                    onChange={(e) => {
                      const newFilters = { ...additionalFilters, maxRating: parseInt(e.target.value) };
                      setAdditionalFilters(newFilters);
                      if (onAdditionalFiltersChange) {
                        onAdditionalFiltersChange(newFilters, selectedGenres);
                      }
                    }}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Облако тегов */}
          {!hideTagsFilter && userTags.length > 0 && (
            <TagCloudFilter
              tags={userTags}
              selectedTags={selectedTags}
              onTagsChange={(tags) => {
                setSelectedTags(tags);
                const newFilters = { ...additionalFilters, selectedTags: tags };
                setAdditionalFilters(newFilters);
                if (onAdditionalFiltersChange) {
                  onAdditionalFiltersChange(newFilters, selectedGenres);
                }
              }}
            />
          )}

          {/* Фильтр по жанрам */}
          {!hideGenresFilter && (
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Жанры {availableGenres.length > 0 && `(${availableGenres.length})`}
              </label>
              {availableGenres.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {availableGenres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
                        selectedGenres.includes(genre.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">Добавьте фильмы для отображения жанров</p>
              )}
            </div>
          )}

          {/* Кнопка сброса */}
          {hasActiveAdditionalFilters && (
            <button
              onClick={resetAdditionalFilters}
              className="w-full py-2 rounded bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 hover:text-gray-300 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </div>
  );
}