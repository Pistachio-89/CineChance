// src/app/recommendations/RecommendationsClient.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import RecommendationCard from './RecommendationCard';
import FilterForm from './FilterForm';
import SessionTracker from './SessionTracker';
import RecommendationActions from './RecommendationActions';
import FilterStateManager from './FilterStateManager';

// Типы данных
interface MovieData {
  id: number;
  media_type: 'movie' | 'tv' | 'anime';
  title: string;
  name: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string | null;
  first_air_date: string | null;
  overview: string;
  runtime: number;
  genres: { id: number; name: string }[];
  genre_ids?: number[];
  original_language?: string;
  production_countries?: { name: string }[];
  cast?: { id: number; name: string; character: string; profilePath: string | null }[];
  crew?: { id: number; name: string; job: string; department: string; profilePath: string | null }[];
}

interface RecommendationResponse {
  success: boolean;
  movie: MovieData | null;
  logId: string | null;
  userStatus: 'want' | 'watched' | 'dropped' | 'rewatched' | null;
  cineChanceRating: number | null;
  cineChanceVoteCount: number;
  userRating: number | null;
  watchCount: number;
  message?: string;
}

interface RecommendationsClientProps {
  userId: string;
}

type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface AdditionalFilters {
  minRating: number;
  maxRating: number;
  yearFrom: string;
  yearTo: string;
  selectedGenres: number[];
}

type ViewState = 'filters' | 'loading' | 'result' | 'error';

export default function RecommendationsClient({ userId }: RecommendationsClientProps) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>('filters');
  const [movie, setMovie] = useState<MovieData | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<'want' | 'watched' | 'dropped' | 'rewatched' | null>(null);
  const [isAnime, setIsAnime] = useState(false);
  const [cineChanceRating, setCineChanceRating] = useState<number | null>(null);
  const [cineChanceVoteCount, setCineChanceVoteCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [watchCount, setWatchCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noAvailable, setNoAvailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Получение года из даты
  const getYear = (movieData: MovieData) => {
    const date = movieData.release_date || movieData.first_air_date;
    return date ? date.split('-')[0] : '—';
  };

  // Обработчики действий через SessionTracker
  const handleTrackEvent = useCallback((eventType: string, data: any) => {
    // Этот обработчик будет передан через SessionTracker
  }, []);

  const handleRecordSignal = useCallback((signalType: string, data: any) => {
    // Этот обработчик будет передан через SessionTracker
  }, []);

  // Обработчики действий с фильмами
  const handleAddToWatchlist = useCallback(async (movie: MovieData) => {
    // Логика добавления в список просмотра
    console.log('Adding to watchlist:', movie.title);
  }, []);

  const handleRateMovie = useCallback(async (movie: MovieData, rating: number) => {
    // Логика оценки фильма
    console.log('Rating movie:', movie.title, rating);
  }, []);

  const handleMarkAsWatched = useCallback(async (movie: MovieData) => {
    // Логика отметки как просмотренного
    console.log('Marking as watched:', movie.title);
  }, []);

  const handleSkipMovie = useCallback(async (movie: MovieData) => {
    // Логика пропуска фильма
    console.log('Skipping movie:', movie.title);
  }, []);

  const handleGetSimilar = useCallback(async (movie: MovieData) => {
    // Логика получения похожих фильмов
    console.log('Getting similar movies for:', movie.title);
  }, []);

  const handleGetRecommendations = useCallback(async (movie: MovieData) => {
    // Логика получения рекомендаций на основе фильма
    console.log('Getting recommendations based on:', movie.title);
  }, []);

  // Получение рекомендации с фильтрами
  const fetchRecommendation = useCallback(async (
    types: ContentType[],
    lists: ListType[],
    additionalFilters?: AdditionalFilters
  ) => {
    setViewState('loading');
    setErrorMessage(null);
    setNoAvailable(false);
    setMovie(null);
    setUserStatus(null);
    setIsAnime(false);
    setCineChanceRating(null);
    setCineChanceVoteCount(0);
    setUserRating(null);
    setWatchCount(0);

    try {
      // Формируем URL с параметрами фильтров
      const params = new URLSearchParams();
      params.set('types', types.join(','));
      params.set('lists', lists.join(','));

      // Добавляем дополнительные фильтры
      if (additionalFilters) {
        if (additionalFilters.minRating > 0) {
          params.set('minRating', additionalFilters.minRating.toString());
        }
        if (additionalFilters.maxRating < 10) {
          params.set('maxRating', additionalFilters.maxRating.toString());
        }
        if (additionalFilters.yearFrom) {
          params.set('yearFrom', additionalFilters.yearFrom);
        }
        if (additionalFilters.yearTo) {
          params.set('yearTo', additionalFilters.yearTo);
        }
        if (additionalFilters.selectedGenres.length > 0) {
          params.set('genres', additionalFilters.selectedGenres.join(','));
        }
      }

      const res = await fetch(`/api/recommendations/random?${params.toString()}`);
      const data: RecommendationResponse = await res.json();

      if (data.success && data.movie) {
        setMovie(data.movie);
        setLogId(data.logId);
        setUserStatus(data.userStatus);
        setCineChanceRating(data.cineChanceRating);
        setCineChanceVoteCount(data.cineChanceVoteCount);
        setUserRating(data.userRating);
        setWatchCount(data.watchCount);

        // Проверка на аниме
        const isAnimeCheck = (data.movie.genre_ids?.includes(16) || data.movie.genres?.some(g => g.id === 16)) &&
                            data.movie.original_language === 'ja';
        setIsAnime(isAnimeCheck);

        // Анимация progress bar
        setProgress(100);
        setTimeout(() => setViewState('result'), 200);
      } else {
        setErrorMessage(data.message || 'Не удалось получить рекомендацию');
        if (data.message?.includes('Нет доступных рекомендаций') ||
            data.message?.includes('пуст') ||
            data.message?.includes('были показаны за последнюю неделю') ||
            data.message?.includes('Все фильмы из вашего списка') ||
            data.message?.includes('Все доступные рекомендации')) {
          setNoAvailable(true);
        }
        setProgress(100);
        setViewState('error');
      }
    } catch (err) {
      console.error('Error fetching recommendation:', err);
      setErrorMessage('Ошибка при загрузке рекомендации');
      setProgress(100);
      setViewState('error');
    }
  }, []);

  // Сброс логов рекомендаций
  const handleResetLogs = async () => {
    setIsResetConfirmOpen(true);
  };

  // Подтверждение сброса истории
  const confirmResetLogs = async () => {
    setIsResetConfirmOpen(false);

    try {
      const res = await fetch('/api/recommendations/reset-logs', {
        method: 'POST',
      });

      if (res.ok) {
        setViewState('filters');
      } else {
        alert('Ошибка при очистке истории');
      }
    } catch (err) {
      console.error('Error resetting logs:', err);
      alert('Ошибка при очистке истории');
    }
  };

  // Возврат к фильтрам
  const handleBackToFilters = () => {
    setViewState('filters');
    setMovie(null);
    setLogId(null);
    setUserStatus(null);
    setIsAnime(false);
    setCineChanceRating(null);
    setCineChanceVoteCount(0);
    setUserRating(null);
    setWatchCount(0);
  };

  // Обработчик "Пропустить"
  const handleSkip = async () => {
    if (actionLoading || !logId || !movie) return;

    setActionLoading(true);
    await handleSkipMovie(movie);
    setViewState('filters');
    setActionLoading(false);
  };

  // Обработчик "Отлично! Посмотрю"
  const handleAccept = async () => {
    if (actionLoading || !logId || !movie) return;

    setActionLoading(true);

    // Сохраняем данные фильма в sessionStorage для передачи на страницу Мои фильмы
    sessionStorage.setItem('recommendationAccepted', JSON.stringify({
      tmdbId: movie.id,
      mediaType: movie.media_type,
      title: movie.title || movie.name,
      year: getYear(movie),
      logId: logId,
    }));

    router.push('/my-movies');
  };

  // Передаем обработчик открытия модального окна в дочерние компоненты
  const handleInfoClick = useCallback(() => {
    // Логика открытия модального окна
  }, []);

  return (
    <SessionTracker userId={userId} logId={logId}>
      {(tracking) => (
        <FilterStateManager
          onFiltersChange={(filters) => {
            // Обработка изменений фильтров через tracking
            // tracking.trackFilterChange('filters_updated', null, filters);
          }}
        >
          {({ filters, updateFilter, resetFilters, hasActiveFilters }) => (
            <div className="min-h-screen bg-gray-950">
              <div className="container mx-auto px-3 sm:px-4 py-4">
                {/* Заголовок */}
                <h1 className="text-base sm:text-lg font-medium text-white mb-6">
                  Что посмотреть?
                </h1>

                {/* Состояние: Фильтры */}
                {viewState === 'filters' && (
                  <FilterForm
                    onSubmit={(types, lists, additionalFilters) =>
                      fetchRecommendation(types as ContentType[], lists as ListType[], additionalFilters)
                    }
                    isLoading={false}
                    onTypeChange={(types) => updateFilter('types', types)}
                    onListChange={(lists) => updateFilter('lists', lists)}
                    onAdditionalFilterChange={(additionalFilters) => {
                      updateFilter('additionalFilters', additionalFilters);
                    }}
                  />
                )}

                {/* Состояние: Загрузка */}
                {viewState === 'loading' && (
                  <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    {/* Прогресс бар */}
                    <div className="w-full max-w-xs h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-sm">Идёт подбор...</p>
                  </div>
                )}

                {/* Состояние: Результат */}
                {viewState === 'result' && movie && (
                  <div className="max-w-4xl mx-auto">
                    <RecommendationCard
                      movie={movie}
                      userStatus={userStatus}
                      isAnime={isAnime}
                      cineChanceRating={cineChanceRating}
                      cineChanceVoteCount={cineChanceVoteCount}
                      userRating={userRating}
                      watchCount={watchCount}
                      onSkip={handleSkip}
                      onAccept={handleAccept}
                      onBack={handleBackToFilters}
                      onResetFilters={handleBackToFilters}
                      onInfoClick={handleInfoClick}
                      actionLoading={actionLoading}
                    />

                    {/* Действия с рекомендацией */}
                    <RecommendationActions
                      movie={movie}
                      onAddToWatchlist={handleAddToWatchlist}
                      onRateMovie={handleRateMovie}
                      onMarkAsWatched={handleMarkAsWatched}
                      onSkipMovie={handleSkipMovie}
                      onGetSimilar={handleGetSimilar}
                      onGetRecommendations={handleGetRecommendations}
                      onTrackEvent={tracking.trackEvent}
                      onTrackSignal={tracking.trackSignal}
                    />
                  </div>
                )}

                {/* Состояние: Ошибка */}
                {viewState === 'error' && (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                    <div className="text-5xl mb-3">😕</div>
                    <h2 className="text-lg font-bold text-white mb-2">
                      {errorMessage}
                    </h2>
                    <p className="text-gray-500 text-sm mb-4 max-w-xs">
                      {noAvailable
                        ? 'Все фильмы из вашего списка были показаны за последнюю неделю'
                        : 'Попробуйте изменить фильтры'}
                    </p>

                    {noAvailable ? (
                      <div className="flex gap-2 flex-wrap justify-center">
                        <button
                          onClick={handleResetLogs}
                          className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg font-medium hover:bg-yellow-500 transition cursor-pointer"
                        >
                          Сбросить историю
                        </button>
                        <button
                          onClick={handleBackToFilters}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-500 transition cursor-pointer"
                        >
                          Изменить фильтры
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleBackToFilters}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-500 transition cursor-pointer"
                      >
                        Изменить фильтры
                      </button>
                    )}
                  </div>
                )}

                {/* Модальное окно подтверждения сброса истории */}
                {isResetConfirmOpen && (
                  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0a0e17] border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                      <div className="text-center">
                        {/* Иконка предупреждения */}
                        <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">Сбросить историю?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                          Это удалит всю историю показов рекомендаций. После этого вы снова сможете получать рекомендации из всех фильмов.
                        </p>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsResetConfirmOpen(false)}
                            className="flex-1 py-2.5 px-3 bg-gray-700/50 border border-gray-600/30 text-gray-300 text-sm rounded-lg font-medium hover:bg-gray-700 hover:text-white transition cursor-pointer"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={confirmResetLogs}
                            className="flex-1 py-2.5 px-3 bg-yellow-600 text-white text-sm rounded-lg font-medium hover:bg-yellow-500 transition cursor-pointer"
                          >
                            Сбросить
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </FilterStateManager>
      )}
    </SessionTracker>
  );
}