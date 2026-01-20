'use client';

import { useState, useCallback } from 'react';

type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface AdditionalFilters {
  minRating: number;
  yearFrom: string;
  yearTo: string;
  selectedGenres: number[];
}

interface FilterFormProps {
  onSubmit: (types: ContentType[], lists: ListType[], additionalFilters?: AdditionalFilters) => void;
  isLoading: boolean;
  onTypeChange?: (types: ContentType[]) => void;
  onListChange?: (lists: ListType[]) => void;
  onAdditionalFilterChange?: (filters: AdditionalFilters) => void;
  initialMinRating?: number;
}

const defaultAdditionalFilters: AdditionalFilters = {
  minRating: 0,
  yearFrom: '',
  yearTo: '',
  selectedGenres: [],
};

const GENRES = [
  { id: 28, name: 'Боевик' },
  { id: 12, name: 'Приключения' },
  { id: 16, name: 'Анимация' },
  { id: 35, name: 'Комедия' },
  { id: 80, name: 'Криминал' },
  { id: 18, name: 'Драма' },
  { id: 10751, name: 'Семейный' },
  { id: 14, name: 'Фэнтези' },
  { id: 36, name: 'История' },
  { id: 27, name: 'Ужасы' },
  { id: 10402, name: 'Музыка' },
  { id: 9648, name: 'Детектив' },
  { id: 10749, name: 'Мелодрама' },
  { id: 878, name: 'Фантастика' },
  { id: 53, name: 'Триллер' },
  { id: 10752, name: 'Военный' },
];

export default function FilterForm({ 
  onSubmit, 
  isLoading, 
  onTypeChange, 
  onListChange, 
  onAdditionalFilterChange, 
  initialMinRating = 0 
}: FilterFormProps) {
  const [selectedTypes, setSelectedTypes] = useState<ContentType[]>(['movie', 'tv', 'anime']);
  const [selectedLists, setSelectedLists] = useState<ListType[]>(['want', 'watched']);
  const [isAdditionalExpanded, setIsAdditionalExpanded] = useState(false);
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>({
    ...defaultAdditionalFilters,
    minRating: initialMinRating > 0 ? initialMinRating : 0,
  });

  const handleTypeToggle = (type: ContentType) => {
    const newTypes = selectedTypes.includes(type)
      ? (selectedTypes.length === 1 ? selectedTypes : selectedTypes.filter(t => t !== type))
      : [...selectedTypes, type];
    
    setSelectedTypes(newTypes);
    if (onTypeChange) {
      onTypeChange(newTypes);
    }
  };

  const handleListToggle = (list: ListType) => {
    const newLists = selectedLists.includes(list)
      ? (selectedLists.length === 1 ? selectedLists : selectedLists.filter(l => l !== list))
      : [...selectedLists, list];
    
    setSelectedLists(newLists);
    if (onListChange) {
      onListChange(newLists);
    }
  };

  const updateMinRating = (value: number) => {
    const newFilters = { ...additionalFilters, minRating: value };
    setAdditionalFilters(newFilters);
    if (onAdditionalFilterChange) {
      onAdditionalFilterChange(newFilters);
    }
  };

  const updateYearFrom = (value: string) => {
    const newFilters = { ...additionalFilters, yearFrom: value };
    setAdditionalFilters(newFilters);
    if (onAdditionalFilterChange) {
      onAdditionalFilterChange(newFilters);
    }
  };

  const updateYearTo = (value: string) => {
    const newFilters = { ...additionalFilters, yearTo: value };
    setAdditionalFilters(newFilters);
    if (onAdditionalFilterChange) {
      onAdditionalFilterChange(newFilters);
    }
  };

  const toggleGenre = (genreId: number) => {
    const newGenres = additionalFilters.selectedGenres.includes(genreId)
      ? additionalFilters.selectedGenres.filter(id => id !== genreId)
      : [...additionalFilters.selectedGenres, genreId];
    
    const newFilters = { ...additionalFilters, selectedGenres: newGenres };
    setAdditionalFilters(newFilters);
    if (onAdditionalFilterChange) {
      onAdditionalFilterChange(newFilters);
    }
  };

  const resetAdditionalFilters = () => {
    const newFilters = defaultAdditionalFilters;
    setAdditionalFilters(newFilters);
    if (onAdditionalFilterChange) {
      onAdditionalFilterChange(newFilters);
    }
  };

  const hasActiveAdditionalFilters = additionalFilters.minRating > 0 ||
    additionalFilters.yearFrom ||
    additionalFilters.yearTo ||
    additionalFilters.selectedGenres.length > 0;

  const handleSubmit = () => {
    if (selectedTypes.length > 0 && selectedLists.length > 0) {
      onSubmit(selectedTypes, selectedLists, additionalFilters);
    }
  };

  const isSubmitDisabled = selectedTypes.length === 0 || selectedLists.length === 0 || isLoading;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-2xl mx-auto px-4 flex flex-col items-center">
        {/* Блок выбора типа контента */}
        <div className="mb-6 w-full sm:w-82">
          <span className="text-gray-400 text-xs sm:text-sm font-medium mb-2 block text-left">
            Выбор типа
          </span>
          <div className="flex flex-wrap gap-2 w-full sm:w-82">
            {/* Кнопка Фильмы */}
            <button
              type="button"
              onClick={() => handleTypeToggle('movie')}
              className={`
                px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
                relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1
                ${selectedTypes.includes('movie')
                  ? 'text-white shadow-lg shadow-green-900/30 border-transparent'
                  : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
                }
              `}
              style={{
                background: selectedTypes.includes('movie')
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)'
                  : ''
              }}
            >
              <span className="relative z-10">Фильмы</span>
              {selectedTypes.includes('movie') && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent"></div>
              )}
            </button>

            {/* Кнопка Сериалы */}
            <button
              type="button"
              onClick={() => handleTypeToggle('tv')}
              className={`
                px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
                relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1
                ${selectedTypes.includes('tv')
                  ? 'text-white shadow-lg shadow-blue-900/30 border-transparent'
                  : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
                }
              `}
              style={{
                background: selectedTypes.includes('tv')
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(30, 64, 175, 0.95) 100%)'
                  : ''
              }}
            >
              <span className="relative z-10">Сериалы</span>
              {selectedTypes.includes('tv') && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent"></div>
              )}
            </button>

            {/* Кнопка Аниме */}
            <button
              type="button"
              onClick={() => handleTypeToggle('anime')}
              className={`
                px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all duration-200
                relative overflow-hidden border whitespace-nowrap min-w-[70px] text-center flex-1
                ${selectedTypes.includes('anime')
                  ? 'text-white shadow-lg shadow-purple-900/30 border-transparent'
                  : 'text-gray-400 hover:text-gray-300 bg-gray-900/50 border-gray-700 hover:border-gray-600'
                }
              `}
              style={{
                background: selectedTypes.includes('anime')
                  ? 'linear-gradient(135deg, rgba(156, 64, 254, 0.95) 0%, rgba(107, 33, 168, 0.95) 100%)'
                  : ''
              }}
            >
              <span className="relative z-10">Аниме</span>
              {selectedTypes.includes('anime') && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent"></div>
              )}
            </button>
          </div>
        </div>

        {/* Блок выбора списков */}
        <div className="mb-6 w-full sm:w-82">
          <span className="text-gray-400 text-sm font-medium mb-2 block text-left">
            Выбор списков
          </span>
          <div className="flex flex-col gap-2 w-full sm:w-82">
            {/* Кнопка Хочу посмотреть */}
            <button
              type="button"
              onClick={() => handleListToggle('want')}
              className={`
                px-3 py-2 rounded-lg transition-all duration-200 w-full sm:w-82 text-left
                ${selectedLists.includes('want')
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedLists.includes('want') ? 'bg-white' : 'bg-gray-700'}`}>
                  <span className={`font-bold ${selectedLists.includes('want') ? 'text-blue-500 text-base' : 'text-gray-400 text-sm'}`}>+</span>
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${selectedLists.includes('want') ? 'text-white' : 'text-gray-300'}`}>
                    Хочу посмотреть
                  </span>
                  <span className="text-xs text-gray-500">
                    Из списка отложенного
                  </span>
                </div>
              </div>
            </button>

            {/* Кнопка Уже просмотрено */}
            <button
              type="button"
              onClick={() => handleListToggle('watched')}
              className={`
                px-3 py-2 rounded-lg transition-all duration-200 w-full sm:w-82 text-left
                ${selectedLists.includes('watched')
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedLists.includes('watched') ? 'bg-green-500' : 'bg-gray-700'}`}>
                  <span className="text-xs font-bold text-white">✓</span>
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${selectedLists.includes('watched') ? 'text-white' : 'text-gray-300'}`}>
                    Уже просмотрено
                  </span>
                  <span className="text-xs text-gray-500">
                    Просмотренные, пересмотренные
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Кнопка Доп. фильтры */}
        <div className="mb-6 w-full sm:w-82">
          <button
            type="button"
            onClick={() => setIsAdditionalExpanded(!isAdditionalExpanded)}
            className={`
              px-3 py-1.5 rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 
              w-full sm:w-82
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
        {isAdditionalExpanded && (
          <div className="bg-gray-900/80 rounded-lg p-4 space-y-4 border border-gray-800 mb-8 w-full">
            {/* Фильтр по году */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Год выпуска</label>
              <div className="flex gap-2 items-center justify-center sm:justify-start">
                <input
                  type="number"
                  placeholder="От"
                  value={additionalFilters.yearFrom}
                  onChange={(e) => updateYearFrom(e.target.value)}
                  className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="number"
                  placeholder="До"
                  value={additionalFilters.yearTo}
                  onChange={(e) => updateYearTo(e.target.value)}
                  className="w-full sm:w-20 px-2 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Фильтр по рейтингу */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">
                Минимальный рейтинг: {additionalFilters.minRating > 0 ? `от ${additionalFilters.minRating}` : 'любой'}
              </label>
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={additionalFilters.minRating}
                  onChange={(e) => updateMinRating(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>
            </div>

            {/* Фильтр по жанрам */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Жанры</label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 justify-center sm:justify-start">
                {GENRES.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
                      additionalFilters.selectedGenres.includes(genre.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Кнопка сброса */}
            {hasActiveAdditionalFilters && (
              <button
                type="button"
                onClick={resetAdditionalFilters}
                className="w-full py-2 rounded bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 hover:text-gray-300 transition-colors"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        {/* Кнопка подбора рекомендаций */}
        <div className="w-full sm:w-82">
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`
              px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 relative overflow-hidden
              w-full sm:w-82
              ${isSubmitDisabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'
              }
            `}
          >
            {isSubmitDisabled ? (
              <span className="relative z-10">Выберите фильтры</span>
            ) : (
              <>
                <span className="relative z-10">
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Подбор рекомендаций...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Подобрать рекомендации
                    </span>
                  )}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Информационные сообщения */}
        {(selectedTypes.length === 0 || selectedLists.length === 0) && (
          <div className="mt-4 text-xs text-gray-500 text-center space-y-1 w-full sm:w-82">
            {selectedTypes.length === 0 && (
              <p>Выберите хотя бы один тип контента</p>
            )}
            {selectedLists.length === 0 && selectedTypes.length > 0 && (
              <p>Выберите хотя бы один список</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}