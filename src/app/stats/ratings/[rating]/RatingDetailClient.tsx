'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import FilmGridWithFilters, { FilmGridFilters } from '@/app/components/FilmGridWithFilters';

interface RatingDetailClientProps {
  userId: string;
  rating: number;
}

export default function RatingDetailClient({ userId, rating }: RatingDetailClientProps) {
  const searchParams = useSearchParams();
  const source = searchParams.get('source');
  
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [userTags, setUserTags] = useState<Array<{ id: string; name: string; count: number }>>([]);

  // Загружаем доступные жанры и теги пользователя
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getUserGenres } = await import('@/app/my-movies/actions');
        const genres = await getUserGenres(userId);
        setAvailableGenres(genres);
      } catch (error) {
        console.error('Error fetching genres:', error);
      }

      try {
        const { getUserTags } = await import('@/app/actions/tagsActions');
        const result = await getUserTags(userId);
        if (result.success && result.data) {
          setUserTags(result.data.map(tag => ({
            id: tag.id,
            name: tag.name,
            count: tag.usageCount
          })));
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };

    fetchData();
  }, [userId]);

  const fetchMovies = useCallback(
    async (page: number, filters: FilmGridFilters) => {
      try {
        const params = new URLSearchParams();
        params.append('rating', String(rating));
        params.append('page', String(page));
        params.append('limit', String(20));
        
        // Добавляем фильтры (FilmGridFilters - плоская структура)
        params.append('showMovies', String(filters.showMovies));
        params.append('showTv', String(filters.showTv));
        params.append('showAnime', String(filters.showAnime));
        params.append('sortBy', filters.sortBy);
        params.append('sortOrder', filters.sortOrder);
        params.append('minRating', String(filters.minRating));
        params.append('maxRating', String(filters.maxRating));
        
        if (filters.yearFrom) {
          params.append('yearFrom', filters.yearFrom);
        }
        if (filters.yearTo) {
          params.append('yearTo', filters.yearTo);
        }
        
        if (filters.genres?.length) {
          params.append('genres', filters.genres.join(','));
        }
        
        if (filters.tags?.length) {
          params.append('tags', filters.tags.join(','));
        }

        const response = await fetch(`/api/stats/movies-by-rating?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch movies');

        const data = await response.json();
        
        // Обновляем доступные жанры из результатов
        if (data.availableGenres) {
          setAvailableGenres(data.availableGenres);
        }
        
        return {
          movies: data.movies || [],
          hasMore: data.pagination?.hasMore || false,
        };
      } catch (error) {
        console.error('Error fetching movies:', error);
        return { movies: [], hasMore: false };
      }
    },
    [rating]
  );

  return (
    <FilmGridWithFilters 
      fetchMovies={fetchMovies}
      availableGenres={availableGenres}
      userTags={userTags}
      showRatingBadge={true}
      getInitialRating={(movie) => (movie as any).userRating}
      hideRatingFilter={source === 'ratings'}
    />
  );
}
