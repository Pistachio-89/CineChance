// src/app/person/[id]/PersonClient.tsx
'use client';

import { useEffect, useState } from 'react';
import ImageWithProxy from '@/app/components/ImageWithProxy';
import { useRouter } from 'next/navigation';
import MovieCard from '@/app/components/MovieCard';
import { MovieCardErrorBoundary } from '@/app/components/ErrorBoundary';
import Loader from '@/app/components/Loader';
import { Media } from '@/lib/tmdb';
import { BlacklistProvider } from '@/app/components/BlacklistContext';

interface PersonCredit {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  name: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  overview: string;
  character: string;
  popularity: number;
}

interface PersonData {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  filmography: PersonCredit[];
}

interface WatchlistStatus {
  tmdbId: number;
  mediaType: string;
  status: 'want' | 'watched' | 'dropped' | 'rewatched' | null;
  userRating: number | null;
}

interface PersonClientProps {
  personId: string;
}

type SortOption = 'rating' | 'popularity' | 'date';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;
const INITIAL_ITEMS = 30;

export default function PersonClient({ personId }: PersonClientProps) {
  const router = useRouter();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'movie' | 'tv'>('movie');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [displayedItems, setDisplayedItems] = useState<PersonCredit[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [watchlistStatuses, setWatchlistStatuses] = useState<Map<string, WatchlistStatus>>(new Map());

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        const res = await fetch(`/api/person/${personId}`);
        if (!res.ok) throw new Error('Failed to fetch person');
        const data = await res.json();
        setPerson(data);
      } catch (err) {
        setError('Failed to load person');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerson();
  }, [personId]);

  // Загрузка статусов из вишлиста для всех фильмов в фильмографии
  useEffect(() => {
    if (!person) return;

    const fetchWatchlistStatuses = async () => {
      const movies = person.filmography.map(item => ({
        tmdbId: item.id,
        mediaType: item.media_type
      }));

      try {
        const res = await fetch('/api/movies/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movies }),
        });

        if (res.ok) {
          const data = await res.json();
          const statuses = new Map<string, WatchlistStatus>();
          
          person.filmography.forEach(item => {
            const key = `${item.id}-${item.media_type}`;
            const movieData = data[key];
            // Добавляем в Map если фильм есть в watchlist (статус может быть null, undefined или конкретным значением)
            if (movieData) {
              statuses.set(`${item.media_type}_${item.id}`, {
                tmdbId: item.id,
                mediaType: item.media_type,
                status: movieData.status,
                userRating: movieData.userRating,
              });
            }
          });
          
          setWatchlistStatuses(statuses);
        }
      } catch (err) {
        console.error('Failed to fetch watchlist statuses', err);
      }
    };

    fetchWatchlistStatuses();
  }, [person]);

  // Сортировка и фильтрация filmography
  const getSortedFilmography = (filmography: PersonCredit[]) => {
    return [...filmography]
      .filter((item) => item.media_type === activeTab)
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'rating':
            comparison = b.vote_average - a.vote_average;
            break;
          case 'popularity':
            comparison = b.popularity - a.popularity;
            break;
          case 'date':
            const dateA = a.release_date || '';
            const dateB = b.release_date || '';
            comparison = dateB.localeCompare(dateA);
            break;
        }
        
        return sortOrder === 'desc' ? comparison : -comparison;
      });
  };

  // Обновление отображаемых элементов при смене таба, сортировки или загрузке данных
  useEffect(() => {
    if (!person) return;

    const sortedFilmography = getSortedFilmography(person.filmography);
    
    // Показываем только первые INITIAL_ITEMS элементов
    setDisplayedItems(sortedFilmography.slice(0, INITIAL_ITEMS));
    setHasMore(sortedFilmography.length > INITIAL_ITEMS);
  }, [person, activeTab, sortBy, sortOrder]);

  // Обработка скролла для кнопки "Наверх"
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !person) return;

    setLoadingMore(true);

    try {
      const sortedFilmography = getSortedFilmography(person.filmography);
      
      const currentLength = displayedItems.length;
      const nextItems = sortedFilmography.slice(
        currentLength,
        currentLength + ITEMS_PER_PAGE
      );

      setDisplayedItems((prev) => [...prev, ...nextItems]);
      setHasMore(currentLength + nextItems.length < sortedFilmography.length);
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Получаем количество фильмов/сериалов для вкладок
  const movieCount = person?.filmography.filter((i) => i.media_type === 'movie').length || 0;
  const tvCount = person?.filmography.filter((i) => i.media_type === 'tv').length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader size="large" text="Загрузка..." />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error || 'Person not found'}</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
        <div className="container mx-auto px-2 sm:px-3">
          {/* Навигация назад */}
          <div className="mb-4">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Назад
            </button>
          </div>

          {/* Информация об актере */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
            {/* Фото актера */}
            {person.profile_path && (
              <div className="flex-shrink-0 mx-auto sm:mx-0 relative w-32 h-40 sm:w-40 sm:h-56">
                <ImageWithProxy
                  src={`https://image.tmdb.org/t/p/w300${person.profile_path}`}
                  alt={person.name}
                  fill
                  className="object-cover rounded-lg shadow-lg"
                  sizes="(max-width: 640px) 128px, 160px"
                />
              </div>
            )}
            
            {/* Информация */}
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                {person.name}
              </h1>
              
              {/* Дата рождения и место */}
              <div className="text-sm text-gray-400 mb-3">
                {person.birthday && (
                  <span>
                    {new Date(person.birthday).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                    {person.deathday && ` — ${new Date(person.deathday).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}`}
                  </span>
                )}
                {person.place_of_birth && (
                  <span className="ml-2">({person.place_of_birth})</span>
                )}
              </div>

              {/* Биография */}
              {person.biography && (
                <div className="text-sm text-gray-300 max-w-3xl">
                  {person.biography.length > 300 
                    ? `${person.biography.substring(0, 300)}...`
                    : person.biography}
                </div>
              )}
            </div>
          </div>

          {/* Сортировка */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <span className="text-gray-400 text-xs sm:text-sm font-medium mb-1 sm:mb-0 sm:mr-2">Сортировка:</span>
            
            <div className="flex items-center gap-2 w-full">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-750 transition-colors w-full sm:w-[200px]"
              >
                <option value="popularity">По популярности</option>
                <option value="rating">По рейтингу</option>
                <option value="date">По дате выхода</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-750 transition-colors w-16"
              >
                <option value="desc">▼</option>
                <option value="asc">▲</option>
              </select>
            </div>
          </div>

          {/* Вкладки */}
          <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2">
            <button
              onClick={() => setActiveTab('movie')}
              className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'movie'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              Фильмы ({movieCount})
            </button>
            <button
              onClick={() => setActiveTab('tv')}
              className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'tv'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              Сериалы ({tvCount})
            </button>
          </div>

          {/* Список фильмов */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
              Фильмография
            </h2>
            
            {displayedItems.length > 0 ? (
              <BlacklistProvider>
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {displayedItems.map((movie, index) => {
                      const statusKey = `${movie.media_type}_${movie.id}`;
                      const watchlistStatus = watchlistStatuses.get(statusKey);
                      
                      return (
                        <div key={statusKey} className="p-1">
                          <MovieCardErrorBoundary>
                          <MovieCard
                            movie={movie as Media}
                            restoreView={false}
                            initialStatus={watchlistStatus?.status}
                            initialUserRating={watchlistStatus?.userRating}
                            showRatingBadge
                            priority={index < 6}
                          />
                          </MovieCardErrorBoundary>
                          {/* Роль актера */}
                          {movie.character && (
                            <p className="text-xs text-gray-500 mt-1 px-1 truncate">
                              {movie.character}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Кнопка "Ещё" */}
                  {hasMore && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {loadingMore ? (
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
              </BlacklistProvider>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-400 text-lg">
                  В фильмографии пока нет работ
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Кнопка "Наверх" */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
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
