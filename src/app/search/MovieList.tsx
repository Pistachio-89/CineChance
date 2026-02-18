// src/app/search/MovieList.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import MovieCard from '../components/MovieCard';
import { MovieCardErrorBoundary } from '../components/ErrorBoundary';
import { Media } from '@/lib/tmdb';

interface MovieListProps {
  movies: Media[];
  batchData: Record<string, any>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  initialScrollY: number;
  onScrollYChange: (y: number) => void;
}

export default function MovieList({ 
  movies, 
  batchData, 
  hasNextPage, 
  isFetchingNextPage, 
  onFetchNextPage,
  initialScrollY,
  onScrollYChange
}: MovieListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef(movies.length);

  // Restore scroll position after new items are rendered
  useEffect(() => {
    if (movies.length > previousCountRef.current) {
      // New items were added, restore scroll position
      window.scrollTo({ top: initialScrollY, behavior: 'auto' });
    }
    previousCountRef.current = movies.length;
  }, [movies.length, initialScrollY]);

  return (
    <>
      <div 
        ref={listRef}
        className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4"
      >
        {movies.map((item, index) => {
          const key = `${item.id}-${item.media_type}`;
          const batch = batchData[key] || {};
          
          return (
            <div
              key={`${item.media_type}_${item.id}`}
              className="w-full min-w-0 p-1"
            >
              <MovieCardErrorBoundary>
                <MovieCard 
                  movie={item} 
                  priority={index < 6}
                  initialStatus={batch.status as 'want' | 'watched' | 'dropped' | 'rewatched' | null | undefined}
                  initialIsBlacklisted={batch.isBlacklisted}
                  initialUserRating={batch.userRating}
                  initialWatchCount={batch.watchCount}
                  initialAverageRating={batch.averageRating}
                  initialRatingCount={batch.ratingCount}
                />
              </MovieCardErrorBoundary>
            </div>
          );
        })}
      </div>

      {/* Кнопка "Ещё" */}
      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onFetchNextPage}
            disabled={isFetchingNextPage}
            className="px-6 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin"></div>
                Загрузка...
              </>
            ) : (
              'Ещё...'
            )}
          </button>
        </div>
      )}
    </>
  );
}
