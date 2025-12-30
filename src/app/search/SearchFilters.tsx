// src/app/search/SearchFilters.tsx
'use client';

import { useState } from 'react';

interface SearchFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  totalResults: number;
}

export interface FilterState {
  type: 'all' | 'movie' | 'tv' | 'anime';
  yearFrom: string;
  yearTo: string;
  quickYear: string;
  genres: number[];
  ratingFrom: number;
  sortBy: 'popularity' | 'rating' | 'date';
  sortOrder: 'desc' | 'asc';
}

const GENRES = [
  { id: 28, name: 'Боевик' },
  { id: 12, name: 'Приключения' },
  { id: 16, name: 'Анимация' },
  { id: 35, name: 'Комедия' },
  { id: 80, name: 'Криминал' },
  { id: 99, name: 'Документальный' },
  { id: 18, name: 'Драма' },
  { id: 10751, name: 'Семейный' },
  { id: 14, name: 'Фэнтези' },
  { id: 36, name: 'История' },
  { id: 27, name: 'Ужасы' },
  { id: 10402, name: 'Музыка' },
  { id: 9648, name: 'Детектив' },
  { id: 10749, name: 'Мелодрама' },
  { id: 878, name: 'Фантастика' },
  { id: 10770, name: 'Телефильм' },
  { id: 53, name: 'Триллер' },
  { id: 10752, name: 'Военный' },
  { id: 37, name: 'Вестерн' },
];

const YEAR_QUICK_FILTERS = [
  { value: '', label: 'Любой' },
  { value: '2025', label: '2025' },
  { value: '2020s', label: '20-е' },
  { value: '2010s', label: '10-е' },
  { value: '2000s', label: '00-е' },
  { value: '1990s', label: '90-е' },
  { value: '1980s', label: '80-е' },
  { value: '1970s', label: '70-е' },
  { value: '1960s', label: '60-е' },
];

export default function SearchFilters({ onFiltersChange, totalResults }: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    yearFrom: '',
    yearTo: '',
    quickYear: '',
    genres: [],
    ratingFrom: 0,
    sortBy: 'popularity',
    sortOrder: 'desc',
  });

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    if (key === 'quickYear') {
      newFilters.yearFrom = '';
      newFilters.yearTo = '';
    }
    if (key === 'yearFrom' || key === 'yearTo') {
      newFilters.quickYear = '';
    }
    
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const toggleGenre = (genreId: number) => {
    const newGenres = filters.genres.includes(genreId)
      ? filters.genres.filter(id => id !== genreId)
      : [...filters.genres, genreId];
    handleFilterChange('genres', newGenres);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      type: 'all',
      yearFrom: '',
      yearTo: '',
      quickYear: '',
      genres: [],
      ratingFrom: 0,
      sortBy: 'popularity',
      sortOrder: 'desc',
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = filters.type !== 'all' || 
    filters.yearFrom || filters.yearTo || filters.quickYear ||
    filters.genres.length > 0 ||
    filters.ratingFrom > 0 ||
    filters.sortBy !== 'popularity' ||
    filters.sortOrder !== 'desc';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">
          Найдено: {totalResults} {totalResults === 1 ? 'результат' : totalResults < 5 ? 'результата' : 'результатов'}
        </span>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
            hasActiveFilters 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
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
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Фильтры {hasActiveFilters && '•'}
        </button>
      </div>

      {isExpanded && (
        <div className="bg-gray-900/80 rounded-lg p-4 space-y-4 border border-gray-800">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Тип контента</label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Все' },
                { value: 'movie', label: 'Фильмы' },
                { value: 'tv', label: 'Сериалы' },
                { value: 'anime', label: 'Аниме' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFilterChange('type', option.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    filters.type === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Год выпуска</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {YEAR_QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => handleFilterChange('quickYear', filter.value)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    filters.quickYear === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="От"
                value={filters.yearFrom}
                onChange={(e) => handleFilterChange('yearFrom', e.target.value)}
                className="w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-500">—</span>
              <input
                type="number"
                placeholder="До"
                value={filters.yearTo}
                onChange={(e) => handleFilterChange('yearTo', e.target.value)}
                className="w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Жанры</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    filters.genres.includes(genre.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">
              Мин. рейтинг TMDB: {filters.ratingFrom > 0 ? filters.ratingFrom : 'Любой'}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={filters.ratingFrom}
              onChange={(e) => handleFilterChange('ratingFrom', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Сортировка</label>
            <div className="flex gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              >
                <option value="popularity">По популярности</option>
                <option value="rating">По рейтингу</option>
                <option value="date">По дате выхода</option>
              </select>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              >
                <option value="desc">▼</option>
                <option value="asc">▲</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="w-full py-2 rounded bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </div>
  );
}
