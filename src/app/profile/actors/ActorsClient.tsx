// src/app/profile/actors/ActorsClient.tsx
'use client';

import { useState, useEffect } from 'react';
import ImageWithProxy from '@/app/components/ImageWithProxy';
import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';
import '@/app/profile/components/AchievementCards.css';

interface ActorAchievement {
  id: number;
  name: string;
  profile_path: string | null;
  watched_movies: number;
  total_movies: number;
  progress_percent: number;
  average_rating: number | null;
}

interface ActorsClientProps {
  userId: string;
}

const ITEMS_PER_PAGE = 12;
const INITIAL_ITEMS = 24;

// Skeleton для карточки актера
function ActorCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-lg bg-gray-800 border border-gray-700" />
      <div className="mt-2 h-4 bg-gray-800 rounded w-3/4" />
      <div className="mt-1 h-3 bg-gray-900 rounded w-1/2" />
    </div>
  );
}

// Skeleton для всей страницы
function PageSkeleton() {
  const skeletonCount = 12;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <ActorCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function ActorsClient({ userId }: ActorsClientProps) {
  const [allActors, setAllActors] = useState<ActorAchievement[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const fetchActors = async () => {
      try {
        const res = await fetch('/api/user/achiev_actors');
        if (!res.ok) throw new Error('Failed to fetch actors');
        const data = await res.json();
        setAllActors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch actors:', err);
        setError('Не удалось загрузить актеров');
      } finally {
        setLoading(false);
      }
    };

    fetchActors();
  }, [userId]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const visibleActors = allActors.slice(0, visibleCount);
  const hasMore = visibleCount < allActors.length;
  const isLoadingMore = false;

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton заголовка */}
        <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
        {/* Skeleton сетки */}
        <PageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-6">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (allActors.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-6 border border-gray-800">
        <p className="text-gray-400 text-center py-10">
          У вас пока нет любимых актеров
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Сетка актеров */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visibleActors
          .sort((a, b) => {
            // Первичная сортировка по средней оценке (null в конце)
            if (a.average_rating !== null && b.average_rating !== null) {
              if (b.average_rating !== a.average_rating) {
                return b.average_rating - a.average_rating;
              }
            } else if (a.average_rating === null && b.average_rating !== null) {
              return 1;
            } else if (a.average_rating !== null && b.average_rating === null) {
              return -1;
            }
            
            // Вторичная сортировка по проценту заполнения
            if (b.progress_percent !== a.progress_percent) {
              return b.progress_percent - a.progress_percent;
            }
            
            // Третичная сортировка по алфавиту
            return a.name.localeCompare(b.name, 'ru');
          })
          .map((actor) => {
          const progressPercent = actor.progress_percent || 0;
          const grayscaleValue = 100 - progressPercent;
          const saturateValue = progressPercent;
          
          return (
            <Link
              key={actor.id}
              href={`/person/${actor.id}`}
              className="group relative"
            >
              <div className="relative">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 border border-gray-700 group-hover:border-amber-500/50 transition-all relative">
                  {actor.profile_path ? (
                    <div className="w-full h-full relative">
                      <ImageWithProxy
                        src={`https://image.tmdb.org/t/p/w300${actor.profile_path}`}
                        alt={actor.name}
                        fill
                        className="object-cover transition-all duration-300 group-hover:grayscale-0 group-hover:saturate-100 achievement-poster"
                        sizes="120px"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
                    <div 
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  
                  <div className="absolute top-2 right-2 bg-amber-600/90 text-white text-xs font-medium px-2 py-1 rounded">
                    {actor.progress_percent}%
                  </div>
                </div>
                
                <h3 className="mt-2 text-gray-300 text-sm truncate group-hover:text-amber-400 transition-colors">
                  {actor.name}
                </h3>
                
                <div className="flex items-center justify-between mt-1">
                  <p className="text-gray-500 text-xs">
                    <span className="text-green-400">{actor.watched_movies}</span>
                    {' / '}
                    <span>{actor.total_movies}</span>
                    {' фильмов'}
                  </p>
                  {actor.average_rating !== null && (
                    <div className="flex items-center bg-gray-800/50 rounded text-sm flex-shrink-0">
                      <div className="w-5 h-5 relative mx-1">
                        <Image 
                          src="/images/logo_mini_lgt.png" 
                          alt="CineChance Logo" 
                          fill 
                          className="object-contain" 
                        />
                      </div>
                      <span className="text-gray-200 font-medium pr-2">
                        {actor.average_rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoadingMore ? (
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

      <p className="text-gray-500 text-sm text-center pt-4">
        Показано {visibleActors.length} из {allActors.length} актеров
      </p>

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
  );
}
