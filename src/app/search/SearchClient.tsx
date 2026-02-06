// src/app/search/SearchClient.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MovieList from './MovieList';
import SearchFilters, { FilterState } from './SearchFilters';
import { useSearch, useBatchData } from '@/hooks';
import { Media } from '@/lib/tmdb';
import { useSession } from 'next-auth/react';
import LoaderSkeleton from '@/app/components/LoaderSkeleton';

interface SearchClientProps {
  initialQuery: string;
}

export default function SearchClient({ initialQuery }: SearchClientProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Blacklist state - загружаем клиентски для актуальности данных
  const [blacklistedIds, setBlacklistedIds] = useState<number[]>([]);

  // Fetch blacklist data on mount
  useEffect(() => {
    const fetchBlacklist = async () => {
      if (!userId) {
        setBlacklistedIds([]);
        return;
      }

      try {
        const response = await fetch('/api/user/blacklist');
        if (response.ok) {
          const blacklist = await response.json();
          setBlacklistedIds(blacklist.map((b: { tmdbId: number }) => b.tmdbId));
        }
      } catch (err) {
        console.error('Failed to fetch blacklist', err);
        setBlacklistedIds([]);
      }
    };

    fetchBlacklist();
  }, [userId]);

  // Filter state
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Scroll tracking
  const scrollYRef = useRef(0);
  const batchDataRef = useRef<Record<string, any>>({});

  // Build search params
  const buildSearchParams = () => {
    const filters = currentFilters;
    
    let typeValue = 'all';
    if (filters) {
      const types: string[] = [];
      if (filters.showMovies) types.push('movie');
      if (filters.showTv) types.push('tv');
      if (filters.showAnime) types.push('anime');
      typeValue = types.length > 0 ? types.join(',') : 'all';
    }

    const genresString = filters?.genres && filters.genres.length > 0 
      ? filters.genres.join(',') 
      : '';

    return {
      q: initialQuery,
      type: typeValue !== 'all' ? typeValue : undefined,
      yearFrom: filters?.yearFrom,
      yearTo: filters?.yearTo,
      quickYear: filters?.quickYear,
      genres: genresString || undefined,
      ratingFrom: filters?.ratingFrom,
      ratingTo: filters?.ratingTo && filters.ratingTo < 10 ? filters.ratingTo : undefined,
      sortBy: filters?.sortBy,
      sortOrder: filters?.sortOrder,
      listStatus: filters?.listStatus && filters.listStatus !== 'all' ? filters.listStatus : undefined,
    };
  };

  // Search query
  const searchQuery = useSearch(buildSearchParams(), blacklistedIds);
  
  // Batch data - only for new movies
  const batchQuery = useBatchData(searchQuery.results, batchDataRef.current);

  // Update batch data ref
  useEffect(() => {
    if (batchQuery.data) {
      batchDataRef.current = { ...batchDataRef.current, ...batchQuery.data };
    }
  }, [batchQuery.data]);

  // Fetch next page handler
  const handleFetchNextPage = useCallback(() => {
    if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
      scrollYRef.current = window.scrollY;
      searchQuery.fetchNextPage();
    }
  }, [searchQuery.hasNextPage, searchQuery.isFetchingNextPage, searchQuery.fetchNextPage]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Loading state
  const isLoading = searchQuery.isLoading || searchQuery.isFetching;

  if (!initialQuery) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">Введите запрос в поисковую строку сверху</p>
      </div>
    );
  }

  return (
    <>
      <SearchFilters 
        onFiltersChange={setCurrentFilters} 
        totalResults={searchQuery.totalResults} 
      />

      {isLoading && searchQuery.results.length === 0 ? (
        <LoaderSkeleton variant="grid" text="Поиск фильмов..." skeletonCount={12} />
      ) : searchQuery.isError ? (
        <div className="rounded-lg bg-red-900/20 border border-red-700/50 p-4 text-center mb-4">
          <p className="text-red-400 text-sm font-medium">⚠️ {searchQuery.error instanceof Error ? searchQuery.error.message : 'Ошибка при поиске'}</p>
          {searchQuery.error instanceof Error && searchQuery.error.message.includes('подождите') && (
            <p className="text-red-300 text-xs mt-2">Пожалуйста, дождитесь сброса лимита и повторите попытку.</p>
          )}
        </div>
      ) : searchQuery.results.length > 0 ? (
        <>
          <MovieList
            movies={searchQuery.results as Media[]}
            batchData={batchDataRef.current}
            hasNextPage={searchQuery.hasNextPage}
            isFetchingNextPage={searchQuery.isFetchingNextPage}
            onFetchNextPage={handleFetchNextPage}
            initialScrollY={scrollYRef.current}
            onScrollYChange={(y) => { scrollYRef.current = y; }}
          />

          {/* Кнопка "Наверх" */}
          {showScrollTop && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-50"
              aria-label="Наверх"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            </button>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm mb-2">Ничего не найдено</p>
          <p className="text-gray-500 text-xs">Попробуйте другой запрос</p>
        </div>
      )}
    </>
  );
}
