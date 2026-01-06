// src/app/recommendations/FilterForm.tsx
'use client';

import { useState } from 'react';

type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface FilterFormProps {
  onSubmit: (types: ContentType[], lists: ListType[]) => void;
  isLoading: boolean;
}

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; icon: string; color: string }[] = [
  { value: 'movie', label: 'Фильмы', icon: '🎬', color: 'bg-green-500' },
  { value: 'tv', label: 'Сериалы', icon: '📺', color: 'bg-blue-500' },
  { value: 'anime', label: 'Аниме', icon: '🎌', color: 'bg-[#9C40FE]' },
];

const LIST_OPTIONS: { value: ListType; label: string; description: string; icon: string; color: string }[] = [
  { 
    value: 'want', 
    label: 'Хочу посмотреть', 
    description: 'Из списка отложенного',
    icon: '+', 
    color: 'bg-blue-500' 
  },
  { 
    value: 'watched', 
    label: 'Уже просмотрено', 
    description: 'Просмотренные, пересмотренные',
    icon: '✓', 
    color: 'bg-green-500' 
  },
];

export default function FilterForm({ onSubmit, isLoading }: FilterFormProps) {
  const [selectedTypes, setSelectedTypes] = useState<ContentType[]>(['movie', 'tv', 'anime']);
  const [selectedLists, setSelectedLists] = useState<ListType[]>(['want']);

  const handleTypeToggle = (type: ContentType) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        // Если это последний выбранный тип - не снимаем
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleListToggle = (list: ListType) => {
    setSelectedLists(prev => {
      if (prev.includes(list)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== list);
      }
      return [...prev, list];
    });
  };

  const handleSubmit = () => {
    if (selectedTypes.length > 0 && selectedLists.length > 0) {
      onSubmit(selectedTypes, selectedLists);
    }
  };

  const isSubmitDisabled = selectedTypes.length === 0 || selectedLists.length === 0 || isLoading;

  return (
    <div className="max-w-xs mx-auto">
      <h2 className="text-lg font-bold text-white mb-6 text-center">
        Настройте подбор
      </h2>

      {/* Блок выбора типа контента */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Тип контента
        </h3>
        <div className="space-y-2">
          {CONTENT_TYPE_OPTIONS.map(option => (
            <label
              key={option.value}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${selectedTypes.includes(option.value) 
                  ? 'bg-blue-500/20 border border-blue-500/30' 
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'}
              `}
            >
              <input
                type="checkbox"
                checked={selectedTypes.includes(option.value)}
                onChange={() => handleTypeToggle(option.value)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className={`w-6 h-6 rounded flex items-center justify-center text-sm ${option.color}`}>
                {option.icon}
              </span>
              <span className={`text-sm font-medium ${selectedTypes.includes(option.value) ? 'text-white' : 'text-gray-400'}`}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Блок выбора списков */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Источник
        </h3>
        <div className="space-y-2">
          {LIST_OPTIONS.map(option => (
            <label
              key={option.value}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                ${selectedLists.includes(option.value) 
                  ? 'bg-blue-500/20 border border-blue-500/30' 
                  : 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800'}
              `}
            >
              <input
                type="checkbox"
                checked={selectedLists.includes(option.value)}
                onChange={() => handleListToggle(option.value)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${option.color} text-white`}>
                {option.icon}
              </span>
              <div className="flex-1">
                <span className={`text-sm font-medium block ${selectedLists.includes(option.value) ? 'text-white' : 'text-gray-400'}`}>
                  {option.label}
                </span>
                <span className="text-xs text-gray-500">
                  {option.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Кнопка подбора */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-sm transition-all
          ${isSubmitDisabled
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'}
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Подбор...
          </span>
        ) : (
          'Подобрать рекомендации'
        )}
      </button>

      {/* Подсказка */}
      {selectedTypes.length === 0 && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Выберите хотя бы один тип контента
        </p>
      )}
      {selectedLists.length === 0 && selectedTypes.length > 0 && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Выберите хотя бы один список
        </p>
      )}
    </div>
  );
}
