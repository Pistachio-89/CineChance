// src/app/my-movies/MyMoviesClient.tsx
'use client';

import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import FilmFilters, { FilmFilterState, SortState, AdditionalFilters } from './FilmFilters';
import { MovieWithStatus, fetchMoviesByStatus, getMoviesCounts, getUserGenres, updateWatchStatus } from './actions';
import { getUserTags } from '../actions/tagsActions';
import { Media } from '@/lib/tmdb';
import RatingModal from '../components/RatingModal';

interface MyMoviesClientProps {
  initialWatched: MovieWithStatus[];
  initialWantToWatch: MovieWithStatus[];
  initialDropped: MovieWithStatus[];
  initialHidden: MovieWithStatus[];
  counts: {
    watched: number;
    wantToWatch: number;
    dropped: number;
    hidden: number;
  };
  userId: string;
}

interface AcceptedRecommendation {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: string;
  logId: string;
}

const ITEMS_PER_PAGE = 20;

export default function MyMoviesClient({
  initialWatched,
  initialWantToWatch,
  initialDropped,
  initialHidden,
  counts,
  userId,
}: MyMoviesClientProps) {
  const [activeTab, setActiveTab] = useState<'watched' | 'wantToWatch' | 'dropped' | 'hidden'>('watched');
  const [filmFilters, setFilmFilters] = useState<FilmFilterState>({
    showMovies: true,
    showTv: true,
    showAnime: true,
  });
  const [sort, setSort] = useState<SortState>({
    sortBy: 'rating',
    sortOrder: 'desc',
  });
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>({
    minRating: 0,
    maxRating: 10,
    yearFrom: '',
    yearTo: '',
  });
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  // Пагинация
  const [displayedMovies, setDisplayedMovies] = useState<Record<string, MovieWithStatus[]>>({
    watched: initialWatched,
    wantToWatch: initialWantToWatch,
    dropped: initialDropped,
    hidden: initialHidden,
  });
  const [page, setPage] = useState<Record<string, number>>({
    watched: 1,
    wantToWatch: 1,
    dropped: 1,
    hidden: 1,
  });
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({
    watched: initialWatched.length >= ITEMS_PER_PAGE,
    wantToWatch: initialWantToWatch.length >= ITEMS_PER_PAGE,
    dropped: initialDropped.length >= ITEMS_PER_PAGE,
    hidden: initialHidden.length >= ITEMS_PER_PAGE,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentCounts, setCurrentCounts] = useState(counts);
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [userTags, setUserTags] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const isInitialMount = useRef(true);
  
  // Состояние для popup о просмотре фильма
  const [showWatchedPopup, setShowWatchedPopup] = useState(false);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState<AcceptedRecommendation | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Sentinel для infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // Количество карточек в ряду (адаптивно)
  const [itemsPerRow, setItemsPerRow] = useState(2);
  
  // Отслеживание ширины окна для адаптивной подгрузки
  useLayoutEffect(() => {
    const updateItemsPerRow = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setItemsPerRow(2); // mobile
      } else if (width < 768) {
        setItemsPerRow(3); // sm
      } else if (width < 1024) {
        setItemsPerRow(4); // md
      } else if (width < 1280) {
        setItemsPerRow(5); // lg
      } else {
        setItemsPerRow(6); // xl
      }
    };
    
    updateItemsPerRow();
    window.addEventListener('resize', updateItemsPerRow);
    return () => window.removeEventListener('resize', updateItemsPerRow);
  }, []);
  
  // Проверка: пришел ли пользователь со страницы рекомендаций
  useEffect(() => {
    const recommendationData = sessionStorage.getItem('recommendationAccepted');
    if (recommendationData) {
      try {
        const data = JSON.parse(recommendationData) as AcceptedRecommendation;
        setAcceptedRecommendation(data);
        setShowWatchedPopup(true);
        // Удаляем из storage после прочтения
        sessionStorage.removeItem('recommendationAccepted');
      } catch (e) {
        console.error('Error parsing recommendation data:', e);
      }
    }
  }, []);

  // Логирование действия
  const logRecommendationAction = async (action: 'accepted_no' | 'accepted_yes') => {
    if (!acceptedRecommendation?.logId) return;
    
    try {
      await fetch(`/api/recommendations/${acceptedRecommendation.logId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.error('Error logging recommendation action:', err);
    }
  };

  // Обработчик "Нет" - закрыть popup
  const handleWatchedNo = async () => {
    await logRecommendationAction('accepted_no');
    setShowWatchedPopup(false);
    setAcceptedRecommendation(null);
  };

  // Обработчик "Да" - открыть RatingModal
  const handleWatchedYes = async () => {
    setShowWatchedPopup(false);
    setShowRatingModal(true);
  };

  // Обработчик сохранения оценки из RatingModal
  const handleRatingSave = async (rating: number, _date: string) => {
    if (!acceptedRecommendation) return;

    // Определяем новый статус
    const newStatus = acceptedRecommendation.title.includes('(пересмотр)') 
      ? 'Просмотрено' 
      : 'Пересмотрено';

    try {
      await updateWatchStatus(
        userId,
        acceptedRecommendation.tmdbId,
        acceptedRecommendation.mediaType,
        newStatus,
        rating,
        acceptedRecommendation.logId
      );
      
      await logRecommendationAction('accepted_yes');
      
      // Обновляем счетчики
      const newCounts = await getMoviesCounts(userId);
      setCurrentCounts(newCounts);
      
      // Перезагружаем текущую вкладку
      await refreshCurrentTab();
    } catch (error) {
      console.error('Error updating watch status:', error);
    } finally {
      setShowRatingModal(false);
      setAcceptedRecommendation(null);
    }
  };

  // Функция перезагрузки текущей вкладки
  const refreshCurrentTab = async () => {
    setLoadingMore(true);
    try {
      let statusName: string | string[] | null = null;
      if (activeTab === 'watched') statusName = ['Просмотрено', 'Пересмотрено'];
      else if (activeTab === 'wantToWatch') statusName = 'Хочу посмотреть';
      else if (activeTab === 'dropped') statusName = 'Брошено';

      const includeHidden = activeTab === 'hidden';

      const result = await fetchMoviesByStatus(
        userId,
        statusName,
        includeHidden,
        1,
        sort.sortBy,
        sort.sortOrder,
        itemsPerRow
      );

      const filteredMovies = filterMovies(result.movies);

      setDisplayedMovies(prev => ({
        ...prev,
        [activeTab]: filteredMovies,
      }));

      setPage(prev => ({
        ...prev,
        [activeTab]: 1,
      }));

      setHasMore(prev => ({
        ...prev,
        [activeTab]: result.hasMore,
      }));
    } catch (error) {
      console.error('Error refreshing tab:', error);
    } finally {
      setLoadingMore(false);
    }
  };
  
  // Загружаем доступные жанры из коллекции пользователя
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genres = await getUserGenres(userId);
        setAvailableGenres(genres);
      } catch (error) {
        console.error('Error fetching user genres:', error);
      }
    };
    
    fetchGenres();
    fetchUserTags();
  }, [userId]);
  
  // Загружаем теги пользователя
  const fetchUserTags = async () => {
    try {
      const result = await getUserTags(userId);
      if (result.success && result.data) {
        setUserTags(result.data.map(tag => ({
          id: tag.id,
          name: tag.name,
          count: tag.usageCount
        })));
      }
    } catch (error) {
      console.error('Error fetching user tags:', error);
    }
  };
  
  // Функция определения аниме по жанру и языку
  const isAnimeQuick = (movie: MovieWithStatus): boolean => {
    const hasAnimeGenre = movie.genre_ids?.includes(16) ?? false;
    return hasAnimeGenre && movie.original_language === 'ja';
  };

  // Функция фильтрации списка фильмов
  const filterMovies = useCallback((movies: MovieWithStatus[]): MovieWithStatus[] => {
    return movies.filter(movie => {
      const isAnime = isAnimeQuick(movie);
      
      if (isAnime) {
        if (!filmFilters.showAnime) return false;
      } else if (movie.media_type === 'movie') {
        if (!filmFilters.showMovies) return false;
      } else if (movie.media_type === 'tv') {
        if (!filmFilters.showTv) return false;
      }
      
      const releaseYear = (movie.release_date || movie.first_air_date || '').split('-')[0];
      if (additionalFilters.yearFrom && parseInt(releaseYear) < parseInt(additionalFilters.yearFrom)) {
        return false;
      }
      if (additionalFilters.yearTo && parseInt(releaseYear) > parseInt(additionalFilters.yearTo)) {
        return false;
      }
      
      const userRating = movie.userRating ?? 0;
      if (userRating < additionalFilters.minRating || userRating > additionalFilters.maxRating) {
        return false;
      }
      
      if (selectedGenres.length > 0) {
        if (!movie.genre_ids) {
          return false;
        }
        const hasMatchingGenre = selectedGenres.some(genreId => movie.genre_ids!.includes(genreId));
        if (!hasMatchingGenre) return false;
      }
      
      // Фильтрация по тегам (логика "хотя бы один из выбранных")
      if (additionalFilters.selectedTags && additionalFilters.selectedTags.length > 0) {
        const movieTagIds = movie.tags?.map(t => t.id) || [];
        const hasMatchingTag = additionalFilters.selectedTags.some(tagId => movieTagIds.includes(tagId));
        if (!hasMatchingTag) return false;
      }
      
      return true;
    });
  }, [filmFilters, additionalFilters, selectedGenres]);

  // Функция фильтрации отображаемых фильмов
  const getFilteredMovies = useCallback((movies: MovieWithStatus[]) => {
    return filterMovies(movies);
  }, [filterMovies]);

  // Infinite scroll через Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const sentinel = entries[0];
        if (sentinel.isIntersecting && hasMore[activeTab] && !loadingMore) {
          loadMoreMovies();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );
    
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [activeTab, hasMore, loadingMore, page, sort, userId, filterMovies, itemsPerRow]);

  // Эффект: перезагрузка данных при изменении сортировки
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const reloadWithNewSort = async () => {
      setLoadingMore(true);
      try {
        let statusName: string | string[] | null = null;
        if (activeTab === 'watched') statusName = ['Просмотрено', 'Пересмотрено'];
        else if (activeTab === 'wantToWatch') statusName = 'Хочу посмотреть';
        else if (activeTab === 'dropped') statusName = 'Брошено';

        const includeHidden = activeTab === 'hidden';

        const result = await fetchMoviesByStatus(
          userId,
          statusName,
          includeHidden,
          1,
          sort.sortBy,
          sort.sortOrder,
          itemsPerRow
        );

        const filteredMovies = filterMovies(result.movies);

        setDisplayedMovies(prev => ({
          ...prev,
          [activeTab]: filteredMovies,
        }));

        setPage(prev => ({
          ...prev,
          [activeTab]: 1,
        }));

        setHasMore(prev => ({
          ...prev,
          [activeTab]: result.hasMore,
        }));
      } catch (error) {
        console.error('Error reloading movies after sort change:', error);
      } finally {
        setLoadingMore(false);
      }
    };

    reloadWithNewSort();
  }, [sort.sortBy, sort.sortOrder, activeTab, userId, filterMovies]);

  // Загрузка дополнительных фильмов
  const loadMoreMovies = async () => {
    if (loadingMore) return;

    const currentPage = page[activeTab];
    const nextPage = currentPage + 1;
    
    setLoadingMore(true);

    try {
      let statusName: string | string[] | null = null;
      if (activeTab === 'watched') statusName = ['Просмотрено', 'Пересмотрено'];
      else if (activeTab === 'wantToWatch') statusName = 'Хочу посмотреть';
      else if (activeTab === 'dropped') statusName = 'Брошено';

      const includeHidden = activeTab === 'hidden';

      const result = await fetchMoviesByStatus(
        userId,
        statusName,
        includeHidden,
        nextPage,
        sort.sortBy,
        sort.sortOrder,
        itemsPerRow
      );

      const filteredNewMovies = filterMovies(result.movies);
      
      const existingIds = new Set(displayedMovies[activeTab].map(m => m.id));
      const uniqueNewMovies = filteredNewMovies.filter(m => !existingIds.has(m.id));
      
      setDisplayedMovies(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], ...uniqueNewMovies],
      }));
      
      setPage(prev => ({
        ...prev,
        [activeTab]: nextPage,
      }));
      
      setHasMore(prev => ({
        ...prev,
        [activeTab]: result.hasMore,
      }));
    } catch (error) {
      console.error('Error loading more movies:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Переключение вкладки
  const handleTabChange = async (newTab: typeof activeTab) => {
    if (newTab === activeTab) return;

    setActiveTab(newTab);
    setLoadingMore(true);

    try {
      let statusName: string | string[] | null = null;
      if (newTab === 'watched') statusName = ['Просмотрено', 'Пересмотрено'];
      else if (newTab === 'wantToWatch') statusName = 'Хочу посмотреть';
      else if (newTab === 'dropped') statusName = 'Брошено';

      const includeHidden = newTab === 'hidden';

      const result = await fetchMoviesByStatus(
        userId,
        statusName,
        includeHidden,
        1,
        sort.sortBy,
        sort.sortOrder,
        itemsPerRow
      );

      const filteredMovies = filterMovies(result.movies);

      setDisplayedMovies(prev => ({
        ...prev,
        [newTab]: filteredMovies,
      }));
      
      setPage(prev => ({
        ...prev,
        [newTab]: 1,
      }));
      
      setHasMore(prev => ({
        ...prev,
        [newTab]: result.hasMore,
      }));

      const newCounts = await getMoviesCounts(userId);
      setCurrentCounts(newCounts);
    } catch (error) {
      console.error('Error switching tab:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const currentMovies = getFilteredMovies(displayedMovies[activeTab]);
  const isRestoreView = activeTab === 'hidden';
  const showLoadingSpinner = hasMore[activeTab] && loadingMore;
  const tabCounts = {
    watched: currentCounts.watched,
    wantToWatch: currentCounts.wantToWatch,
    dropped: currentCounts.dropped,
    hidden: currentCounts.hidden,
  };

  const tabs = [
    { id: 'watched' as const, label: 'Просмотрено', count: tabCounts.watched },
    { id: 'wantToWatch' as const, label: 'Хочу посмотреть', count: tabCounts.wantToWatch },
    { id: 'dropped' as const, label: 'Брошено', count: tabCounts.dropped },
    { 
      id: 'hidden' as const, 
      label: 'Скрытые', 
      count: tabCounts.hidden,
      className: 'text-gray-500 hover:text-gray-400' 
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      {/* Popup: Вы просмотрели фильм? */}
      {showWatchedPopup && acceptedRecommendation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white text-center mb-4">
              Вы просмотрели фильм
            </h3>
            <p className="text-gray-300 text-center mb-6">
              {acceptedRecommendation.title} ({acceptedRecommendation.year})?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleWatchedNo}
                className="flex-1 py-3 px-4 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition"
              >
                Нет
              </button>
              <button
                onClick={handleWatchedYes}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-500 transition"
              >
                Да
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RatingModal - используем существующий компонент */}
      {acceptedRecommendation && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setAcceptedRecommendation(null);
          }}
          onSave={handleRatingSave}
          title={acceptedRecommendation.title}
          releaseDate={acceptedRecommendation.year}
          defaultRating={6}
          showWatchedDate={true}
        />
      )}

      <div className="container mx-auto px-2 sm:px-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Мои фильмы
        </h1>

        <FilmFilters 
          onFiltersChange={setFilmFilters} 
          onSortChange={setSort}
          availableGenres={availableGenres}
          userTags={userTags}
          onAdditionalFiltersChange={(filters, genres) => {
            setAdditionalFilters(filters);
            setSelectedGenres(genres);
          }}
        />

        <div className="flex flex-wrap gap-4 mt-3 mb-8 border-b border-gray-800 pb-2">
          {tabs.map((tab) => {
            let baseClasses = "pb-2 px-2 border-b-2 transition-colors relative cursor-pointer ";
            if (activeTab === tab.id) {
              baseClasses += "border-blue-500 text-white";
            } else {
              baseClasses += "border-transparent hover:border-gray-600 ";
              baseClasses += tab.className || "text-gray-400 hover:text-white";
            }

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={baseClasses}
              >
                <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                <span className="ml-2 text-xs sm:text-sm">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {loadingMore && currentMovies.length === 0 ? (
          <Loader text="Загрузка..." />
        ) : currentMovies.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {currentMovies.map((movie, index) => (
                <div key={`${movie.id}-${index}`} className="p-1">
                  <MovieCard 
                    movie={movie as Media} 
                    restoreView={isRestoreView}
                    showRatingBadge 
                    priority={index < 6} 
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} className="h-4" />

            {showLoadingSpinner && (
              <Loader size="small" />
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">
              В этом списке пока ничего нет
            </p>
            <p className="text-gray-500 text-sm mt-4">
              {isRestoreView ? 'Добавляйте фильмы в черный список на главной странице' : 'Добавляйте фильмы с главной страницы или поиска'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
