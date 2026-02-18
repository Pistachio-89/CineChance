// src/app/search/SearchFilters.tsx
'use client';

import { useState, useEffect } from 'react';

interface SearchFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
  totalResults: number;
}

export interface FilterState {
  type: 'all' | 'movie' | 'tv' | 'anime';
  showMovies: boolean;
  showTv: boolean;
  showAnime: boolean;
  showCartoon: boolean;
  yearFrom: string;
  yearTo: string;
  quickYear: string;
  genres: number[];
  ratingFrom: number;
  ratingTo: number;
  sortBy: 'popularity' | 'rating' | 'date';
  sortOrder: 'desc' | 'asc';
  listStatus: 'all' | 'notInList' | 'wantToWatch' | 'watched' | 'dropped';
}

const GENRES = [
  { id: 28, name: 'Боевик' },
  { id: 12, name: 'Приключения' },
  { id: 16, name: 'Аниме' },
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

const CURRENT_YEAR = new Date().getFullYear();

const YEAR_QUICK_FILTERS = [
  { value: '', label: 'Любой' },
  { value: String(CURRENT_YEAR), label: String(CURRENT_YEAR) },
  { value: '2020s', label: '20-е' },
  { value: '2010s', label: '10-е' },
  { value: '2000s', label: '00-е' },
  { value: '1990s', label: '90-е' },
  { value: '1980s', label: '80-е' },
  { value: '1970s', label: '70-е' },
  { value: '1960s', label: '60-е' },
];

export default function SearchFilters({ onFiltersChange, initialFilters, totalResults }: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters || {
    type: 'all',
    showMovies: true,
    showTv: true,
    showAnime: true,
    showCartoon: true,
    yearFrom: '',
    yearTo: '',
    quickYear: '',
    genres: [],
    ratingFrom: 0,
    ratingTo: 10,
    sortBy: 'popularity',
    sortOrder: 'desc',
    listStatus: 'all',
  });

  // Sync with initialFilters when they change
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

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

  const toggleTypeFilter = (key: 'showMovies' | 'showTv' | 'showAnime' | 'showCartoon') => {
    const newFilters = { ...filters, [key]: !filters[key] };
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
      showMovies: true,
      showTv: true,
      showAnime: true,
      showCartoon: true,
      yearFrom: '',
      yearTo: '',
      quickYear: '',
      genres: [],
      ratingFrom: 0,
      ratingTo: 10,
      sortBy: 'popularity',
      sortOrder: 'desc',
      listStatus: 'all',
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = !filters.showMovies || !filters.showTv || !filters.showAnime || !filters.showCartoon ||
    filters.yearFrom || filters.yearTo || filters.quickYear ||
    filters.genres.length > 0 ||
    filters.ratingFrom > 0 || filters.ratingTo < 10 ||
    filters.listStatus !== 'all' ||
    filters.sortBy !== 'popularity' ||
    filters.sortOrder !== 'desc';

  const getTypeButtonClass = (isActive: boolean, gradient: string) => {
    const baseClass = 'px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer';
    
    if (isActive) {
      return `${baseClass} text-white shadow-lg border-transparent ${gradient}`;
    }
    return `${baseClass} text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600`;
  };

  return (
    <div className="mb-4">
      {/* Заголовок с количеством */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">
          Найдено: {totalResults} {totalResults === 1 ? 'результат' : totalResults < 5 ? 'результата' : 'результатов'}
        </span>
      </div>

      {/* Кнопки типов контента */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => toggleTypeFilter('showMovies')}
          className={getTypeButtonClass(filters.showMovies, 'bg-gradient-to-r from-green-500 to-green-700 shadow-green-900/30')}
          style={filters.showMovies ? { background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)' } : {}}
        >
          <span className="relative z-10">Фильмы</span>
          {filters.showMovies && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          )}
        </button>
        
        <button
          onClick={() => toggleTypeFilter('showTv')}
          className={getTypeButtonClass(filters.showTv, 'bg-gradient-to-r from-blue-500 to-blue-700 shadow-blue-900/30')}
          style={filters.showTv ? { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(30, 64, 175, 0.95) 100%)' } : {}}
        >
          <span className="relative z-10">Сериалы</span>
          {filters.showTv && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          )}
        </button>
        
        <button
          onClick={() => toggleTypeFilter('showAnime')}
          className={getTypeButtonClass(filters.showAnime, 'bg-gradient-to-r from-purple-500 to-purple-700 shadow-purple-900/30')}
          style={filters.showAnime ? { background: 'linear-gradient(135deg, rgba(156, 64, 254, 0.95) 0%, rgba(107, 33, 168, 0.95) 100%)' } : {}}
        >
          <span className="relative z-10">Аниме</span>
          {filters.showAnime && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          )}
        </button>

        <button
          onClick={() => toggleTypeFilter('showCartoon')}
          className={getTypeButtonClass(filters.showCartoon, 'bg-gradient-to-r from-orange-500 to-orange-700 shadow-orange-900/30')}
          style={filters.showCartoon ? { background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.95) 0%, rgba(234, 88, 12, 0.95) 100%)' } : {}}
        >
          <span className="relative z-10">Мульты</span>
          {filters.showCartoon && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          )}
        </button>
      </div>

      {/* Блок фильтров по статусу в списке */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleFilterChange('listStatus', 'all')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer ${
            filters.listStatus === 'all'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Все
        </button>
        
        <button
          onClick={() => handleFilterChange('listStatus', 'notInList')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer ${
            filters.listStatus === 'notInList'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Не в списках
        </button>
        
        <button
          onClick={() => handleFilterChange('listStatus', 'wantToWatch')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer ${
            filters.listStatus === 'wantToWatch'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Хочу посмотреть
        </button>
        
        <button
          onClick={() => handleFilterChange('listStatus', 'watched')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer ${
            filters.listStatus === 'watched'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Просмотрено
        </button>
        
        <button
          onClick={() => handleFilterChange('listStatus', 'dropped')}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200 border whitespace-nowrap min-w-[70px] text-center flex-1 sm:flex-none cursor-pointer ${
            filters.listStatus === 'dropped'
              ? 'bg-gray-600 text-white border-gray-500'
              : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          Брошено
        </button>
      </div>

      {/* Блок сортировки и дополнительных фильтров */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          <span className="text-gray-400 text-xs sm:text-sm font-medium mb-1 sm:mb-0 sm:mr-2">Сортировка:</span>
          
          <div className="flex items-center gap-2 w-full">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-750 transition-colors w-full sm:w-[200px]"
            >
              <option value="popularity">По популярности</option>
              <option value="rating">По рейтингу</option>
              <option value="date">По дате выхода</option>
            </select>
            
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
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
            ${hasActiveFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}
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
          <span className="truncate">Доп. фильтры {hasActiveFilters && '•'}</span>
        </button>
      </div>

      {/* Раскрывающаяся панель */}
      {isExpanded && (
        <div className="mt-4 bg-gray-900/80 rounded-lg p-4 space-y-4 border border-gray-800">
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
                className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-500">—</span>
              <input
                type="number"
                placeholder="До"
                value={filters.yearTo}
                onChange={(e) => handleFilterChange('yearTo', e.target.value)}
                className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">
              Рейтинг TMDB: {filters.ratingFrom > 0 || filters.ratingTo < 10 ? `${filters.ratingFrom} - ${filters.ratingTo}` : 'Любой'}
            </label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <span className="text-xs text-gray-500 block mb-1">От</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={filters.ratingFrom}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleFilterChange('ratingFrom', val > filters.ratingTo ? filters.ratingTo : val);
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
                  step="0.5"
                  value={filters.ratingTo}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleFilterChange('ratingTo', val < filters.ratingFrom ? filters.ratingFrom : val);
                  }}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Жанры</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {GENRES.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
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

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
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
