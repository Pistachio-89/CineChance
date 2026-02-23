// src/app/components/RecommendationsGrid.tsx
'use client';

import { useState, useEffect } from 'react';
import MovieCard from './MovieCard';
import ScrollContainer from './ScrollContainer';
import MovieCardSkeleton from './MovieCardSkeleton';
import { Media } from '@/lib/tmdb';
import { logger } from '@/lib/logger';

/**
 * Recommendation item from the API
 */
interface RecommendationItem {
  tmdbId: number;
  mediaType: string;
  title: string;
  score: number;
  algorithm: string;
  sources?: string[];
}

/**
 * API response structure
 */
interface RecommendationsResponse {
  success: boolean;
  recommendations: RecommendationItem[];
  logIds?: string[];
  meta: {
    isColdStart: boolean;
    coldStart?: {
      threshold: number;
      fallbackSource: string | null;
    };
    isHeavyUser: boolean;
    heavyUser?: {
      threshold: number;
      sampleSize: number;
    };
    watchedCount: number;
    algorithmsUsed: string[];
    confidence: {
      value: number;
      factors: {
        algorithmCount: number;
        similarUsersFound: number;
        scoreVariance: number;
        isColdStart: boolean;
        isHeavyUser: boolean;
      };
    };
    durationMs: number;
    cacheHit: boolean;
  };
}

/**
 * Convert recommendation item to Media format for MovieCard
 */
function recommendationToMedia(item: RecommendationItem): Media {
  return {
    id: item.tmdbId,
    media_type: item.mediaType as 'movie' | 'tv',
    title: item.title,
    name: item.title,
    poster_path: null,
    vote_average: item.score / 10, // Convert 0-100 to 0-10
    vote_count: 0,
    overview: '',
  };
}

export default function RecommendationsGrid() {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [logIds, setLogIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<RecommendationsResponse['meta'] | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/recommendations/patterns');

        if (!response.ok) {
          if (response.status === 401) {
            // Not authenticated - not an error, just no recommendations
            setRecommendations([]);
            setIsLoading(false);
            return;
          }
          throw new Error(`Failed to fetch recommendations: ${response.status}`);
        }

        const data: RecommendationsResponse = await response.json();

        if (data.success) {
          setRecommendations(data.recommendations);
          setMeta(data.meta);
          
          // Store logIds mapping in localStorage for outcome tracking
          if (data.logIds && data.recommendations.length > 0) {
            const logIdMap: Record<string, string> = {};
            data.recommendations.forEach((rec, index) => {
              if (data.logIds && data.logIds[index]) {
                logIdMap[String(rec.tmdbId)] = data.logIds[index];
              }
            });
            
            // Store mapping in localStorage
            if (Object.keys(logIdMap).length > 0) {
              localStorage.setItem('rec_logid_map', JSON.stringify(logIdMap));
            }
            
            setLogIds(data.logIds);
          }
        } else {
          setRecommendations([]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Failed to fetch recommendations', {
          error: errorMessage,
          context: 'RecommendationsGrid',
        });
        setError(errorMessage);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  // Loading state - show skeletons
  if (isLoading) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6">Рекомендации для вас</h2>
        <ScrollContainer>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex-shrink-0 w-48">
              <MovieCardSkeleton variant="horizontal" showRatingBadge={false} />
            </div>
          ))}
        </ScrollContainer>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6">Рекомендации для вас</h2>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">Не удалось загрузить рекомендации</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Cold start state - user hasn't watched enough movies
  if (meta?.isColdStart) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6">Рекомендации для вас</h2>
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
          <p className="text-yellow-300 text-lg mb-2">
            Добавьте больше фильмов и сериалов в свой список
          </p>
          <p className="text-gray-400">
            Мы формируем персональные рекомендации на основе ваших просмотров.
            Чем больше фильмов вы отметите как просмотренные, тем точнее будут рекомендации.
            Минимум нужно {meta.coldStart?.threshold || 10} просмотренных фильмов.
          </p>
        </div>
      </div>
    );
  }

  // Empty state - no recommendations available
  if (recommendations.length === 0) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6">Рекомендации для вас</h2>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <p className="text-gray-400">
            Пока нет рекомендаций. Добавьте больше фильмов в свой список просмотров.
          </p>
        </div>
      </div>
    );
  }

  // Show recommendations in horizontal scroll
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Рекомендации для вас</h2>
        {meta?.confidence && (
          <div className="text-sm text-gray-400">
            <span className="text-yellow-400">★</span> {meta.confidence.value}% точность
          </div>
        )}
      </div>
      
      <ScrollContainer>
        {recommendations.map((rec, index) => (
          <div key={`${rec.tmdbId}_${rec.mediaType}`} className="flex-shrink-0 w-48">
            <MovieCard
              movie={recommendationToMedia(rec)}
              priority={index < 4}
            />
          </div>
        ))}
      </ScrollContainer>
    </div>
  );
}
