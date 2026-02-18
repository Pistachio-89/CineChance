// src/app/recommendations/FilterStateManager.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { ContentType, ListType } from '@/lib/recommendation-types';

interface AdditionalFilters {
  minRating: number;
  yearFrom: string;
  yearTo: string;
  selectedGenres: number[];
  selectedTags: string[];
}

export interface FilterState {
  types: ContentType[];
  lists: ListType[];
  additionalFilters?: AdditionalFilters;
}

interface FilterStateManagerProps {
  initialFilters?: Partial<FilterState>;
  onFiltersChange: (filters: FilterState) => void;
  onFilterChange?: (parameterName: string, previousValue: any, newValue: any) => void;
  children: (state: {
    filters: FilterState;
    updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    updateAdditionalFilter: <K extends keyof AdditionalFilters>(key: K, value: AdditionalFilters[K]) => void;
    resetFilters: () => void;
    hasActiveFilters: boolean;
  }) => React.ReactNode;
}

const defaultFilters: FilterState = {
  types: ['movie', 'tv', 'anime'],
  lists: ['want', 'watched'],
  additionalFilters: {
    minRating: 0,
    yearFrom: '',
    yearTo: '',
    selectedGenres: [],
    selectedTags: [],
  },
};

export default function FilterStateManager({
  initialFilters = {},
  onFiltersChange,
  onFilterChange,
  children,
}: FilterStateManagerProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    lists: initialFilters.lists || defaultFilters.lists,
    types: initialFilters.types || defaultFilters.types,
    additionalFilters: initialFilters.additionalFilters || defaultFilters.additionalFilters,
  });

  // Синхронизируем состояние с initialFilters при их изменении
  useEffect(() => {
    if (initialFilters.lists) {
      setFilters(prev => ({ ...prev, lists: initialFilters.lists as ListType[] }));
    }
    if (initialFilters.types) {
      setFilters(prev => ({ ...prev, types: initialFilters.types as ContentType[] }));
    }
    if (initialFilters.additionalFilters) {
      setFilters(prev => ({ ...prev, additionalFilters: initialFilters.additionalFilters }));
    }
  }, [initialFilters]);

  const updateFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => {
      const previousValue = prev[key];
      const newValue = value;
      
      // Вызываем onFilterChange если он предоставлен
      if (onFilterChange && JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
        onFilterChange(key, previousValue, newValue);
      }
      
      return { ...prev, [key]: value };
    });
  }, [onFilterChange]);

  // Добавляем функцию для обновления вложенных свойств additionalFilters
  const updateAdditionalFilter = useCallback(<K extends keyof AdditionalFilters>(
    key: K,
    value: AdditionalFilters[K]
  ) => {
    setFilters(prev => {
      const previousValue = prev.additionalFilters?.[key];
      const newValue = value;
      
      // Вызываем onFilterChange если он предоставлен
      if (onFilterChange && JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
        onFilterChange(`additionalFilters.${key}`, previousValue, newValue);
      }
      
      return {
        ...prev,
        additionalFilters: {
          ...prev.additionalFilters,
          ...defaultFilters.additionalFilters,
          [key]: value
        }
      } as FilterState;
    });
  }, [onFilterChange]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    const defaultValue = defaultFilters[key as keyof FilterState];
    if (Array.isArray(value)) {
      return value.length !== (defaultValue as any)?.length;
    }
    if (key === 'additionalFilters') {
      const additional = value as AdditionalFilters;
      const defaultAdditional = defaultValue as AdditionalFilters;
      return additional.minRating !== defaultAdditional.minRating ||
             additional.yearFrom !== defaultAdditional.yearFrom ||
             additional.yearTo !== defaultAdditional.yearTo ||
             additional.selectedGenres.length !== defaultAdditional.selectedGenres.length ||
             additional.selectedTags.length !== defaultAdditional.selectedTags.length;
    }
    return JSON.stringify(value) !== JSON.stringify(defaultValue);
  });

  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  return (
    <>
      {children({
        filters,
        updateFilter,
        updateAdditionalFilter,
        resetFilters,
        hasActiveFilters,
      })}
    </>
  );
}