// src/app/recommendations/FilterStateManager.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';

type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface AdditionalFilters {
  minRating: number;
  maxRating: number;
  yearFrom: string;
  yearTo: string;
  selectedGenres: number[];
}

export interface FilterState {
  types: ContentType[];
  lists: ListType[];
  additionalFilters?: AdditionalFilters;
}

interface FilterStateManagerProps {
  initialFilters?: Partial<FilterState>;
  onFiltersChange: (filters: FilterState) => void;
  children: (state: {
    filters: FilterState;
    updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    resetFilters: () => void;
    hasActiveFilters: boolean;
  }) => React.ReactNode;
}

const defaultFilters: FilterState = {
  types: ['movie', 'tv', 'anime'],
  lists: ['want', 'watched'],
  additionalFilters: {
    minRating: 0,
    maxRating: 10,
    yearFrom: '',
    yearTo: '',
    selectedGenres: [],
  },
};

export default function FilterStateManager({
  initialFilters = {},
  onFiltersChange,
  children,
}: FilterStateManagerProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    ...initialFilters,
  });

  const updateFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

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
             additional.maxRating !== defaultAdditional.maxRating ||
             additional.yearFrom !== defaultAdditional.yearFrom ||
             additional.yearTo !== defaultAdditional.yearTo ||
             additional.selectedGenres.length !== defaultAdditional.selectedGenres.length;
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
        resetFilters,
        hasActiveFilters,
      })}
    </>
  );
}