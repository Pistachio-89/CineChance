// src/hooks/useSearch.ts
'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Media } from '@/lib/tmdb';

export interface SearchParams {
  q: string;
  type?: string;
  yearFrom?: string;
  yearTo?: string;
  quickYear?: string;
  genres?: string;
  ratingFrom?: number;
  ratingTo?: number;
  sortBy?: string;
  sortOrder?: string;
  listStatus?: string;
}

interface SearchResults {
  results: Media[];
  totalPages: number;
  totalResults: number;
}

const ITEMS_PER_PAGE = 20;

const buildSearchParams = (params: SearchParams, page: number) => {
  const searchParams = new URLSearchParams({
    q: params.q,
    page: String(page),
    limit: String(ITEMS_PER_PAGE),
  });

  if (params.type && params.type !== 'all') {
    searchParams.set('type', params.type);
  }
  if (params.yearFrom) searchParams.set('yearFrom', params.yearFrom);
  if (params.yearTo) searchParams.set('yearTo', params.yearTo);
  if (params.quickYear) searchParams.set('quickYear', params.quickYear);
  if (params.genres) searchParams.set('genres', params.genres);
  if ((params.ratingFrom ?? 0) > 0) searchParams.set('ratingFrom', String(params.ratingFrom));
  if ((params.ratingTo ?? 10) < 10) searchParams.set('ratingTo', String(params.ratingTo));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.listStatus) searchParams.set('listStatus', params.listStatus);

  return searchParams.toString();
};

const fetchSearchResults = async (params: SearchParams, pageParam: number): Promise<SearchResults> => {
  if (!params.q && !params.type && !params.yearFrom && !params.yearTo && !params.genres && (params.ratingFrom ?? 0) === 0 && (params.ratingTo ?? 10) === 10 && params.listStatus === 'all') {
    return { results: [], totalPages: 1, totalResults: 0 };
  }

  const queryString = buildSearchParams(params, pageParam);
  
  try {
    const response = await fetch(`/api/search?${queryString}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Слишком много запросов. Пожалуйста, подождите минуту.');
      }
      if (response.status === 500) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Search service temporarily unavailable');
      }
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Если API вернул ошибку в ответе
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred while searching');
  }
};

export const useSearch = (params: SearchParams, blacklistedIds: number[]) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['search', params] as const,
    queryFn: ({ pageParam }) => fetchSearchResults(params, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      if (lastPage.results.length === 0) return undefined;
      if (currentPage >= lastPage.totalPages) return undefined;
      return currentPage + 1;
    },
    initialPageParam: 1,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error) => {
      // Не ретраим rate limit ошибки автоматически
      if (error instanceof Error) {
        if (error.message.includes('подождите') || error.message.includes('Rate limit')) {
          return false; // Пользователь должен сам повторить после подхода
        }
        if (error.message.includes('Network error')) {
          return failureCount < 2; // До 2 попыток для сетевых ошибок
        }
      }
      return false; // Не ретраим другие ошибки
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Экспоненциальный бэкофф до 30 секунд
  });

  // Simple filter without complex deduplication
  const filteredResults = query.data?.pages.flatMap(page => {
    if (!page.results) return [];
    
    const blacklistedSet = new Set(blacklistedIds);
    
    return page.results.filter((item: Media) => {
      // Filter out blacklisted items and movies with no rating
      if (blacklistedSet.has(item.id) || (item.vote_average ?? 0) <= 0) {
        return false;
      }
      return true;
    });
  }) ?? [];

  const totalResults = query.data?.pages[0]?.totalResults ?? 0;

  return {
    ...query,
    results: filteredResults,
    totalResults,
    prefetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
    refetchWithFilters: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  };
};
