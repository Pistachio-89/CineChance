// src/app/recommendations/RecommendationsClient.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import RecommendationCard from './RecommendationCard';
import FilterForm from './FilterForm';

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

interface ActionResponse {
  success: boolean;
  message: string;
  logId: string;
}

interface UserSessionResponse {
  success: boolean;
  sessionId: string;
  isNew: boolean;
}

interface EventResponse {
  success: boolean;
  eventId: string;
}

interface SignalResponse {
  success: boolean;
  signalId: string;
}

interface FilterSessionResponse {
  success: boolean;
  filterSessionId: string;
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

// Типы для отслеживания
interface FilterChange {
  timestamp: string;
  parameterName: string;
  previousValue: unknown;
  newValue: unknown;
  changeSource: 'user_input' | 'preset' | 'api' | 'reset';
  [key: string]: unknown;
}

interface SessionFlow {
  recommendationsShown: number;
  filtersChangedCount: number;
  modalOpenedCount: number;
  actionsCount: number;
  recommendationsAccepted: number;
  recommendationsSkipped: number;
  [key: string]: unknown;
}

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
  
  // Состояние для трекинга
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filterSessionId, setFilterSessionId] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<{
    types: ContentType[];
    lists: ListType[];
    additionalFilters?: AdditionalFilters;
  } | null>(null);
  
  // Метрики сессии
  const sessionMetrics = useRef<SessionFlow>({
    recommendationsShown: 0,
    filtersChangedCount: 0,
    modalOpenedCount: 0,
    actionsCount: 0,
    recommendationsAccepted: 0,
    recommendationsSkipped: 0,
  });
  
  const filterChanges = useRef<FilterChange[]>([]);
  const fetchStartTime = useRef<number>(0);
  const sessionStartTime = useRef<number>(0);
  const isModalOpen = useRef(false);

  // Получение или создание сессии пользователя
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch('/api/recommendations/user-sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        
        // Проверяем, что ответ - JSON (а не редирект)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Non-JSON response from user-sessions API');
          return;
        }
        
        const data: UserSessionResponse = await res.json();
        if (data.success) {
          setSessionId(data.sessionId);
          sessionStartTime.current = Date.now();
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };

    if (userId) {
      initSession();
    }

    // Завершение сессии при уходе со страницы
    return () => {
      if (sessionId) {
        endSession();
      }
    };
  }, [userId, sessionId]);

  // Завершение сессии
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const durationMs = Date.now() - sessionStartTime.current;
      await fetch('/api/recommendations/user-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionFlow: sessionMetrics.current,
          durationMs,
          endedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [sessionId]);

  // Запись события
  const trackEvent = useCallback(async (
    eventType: string,
    eventData?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    try {
      await fetch('/api/recommendations/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          recommendationLogId: logId || undefined,
          eventType,
          eventData,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  }, [userId, sessionId, logId]);

  // Запись сигнала намерения
  const trackSignal = useCallback(async (
    signalType: string,
    elementContext?: { elementType: string; elementPosition: { x: number; y: number; viewportPercentage: number }; elementVisibility: number },
    rawSignals?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    try {
      const now = Date.now();
      const temporalContext = logId ? {
        timeSinceShownMs: now - fetchStartTime.current,
        timeSinceSessionStartMs: now - sessionStartTime.current,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      } : undefined;

      await fetch('/api/recommendations/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          recommendationLogId: logId || undefined,
          signalType,
          elementContext,
          temporalContext,
          rawSignals,
        }),
      });
    } catch (err) {
      console.error('Error tracking signal:', err);
    }
  }, [userId, sessionId, logId]);

  // Начало сессии фильтров
  const startFilterSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch('/api/recommendations/filter-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          initialFilters: {
            types: ['movie', 'tv', 'anime'],
            lists: ['want', 'watched'],
          },
        }),
      });
      const data: FilterSessionResponse = await res.json();
      if (data.success) {
        setFilterSessionId(data.filterSessionId);
        filterChanges.current = [];
      }
    } catch (err) {
      console.error('Error starting filter session:', err);
    }
  }, [userId, sessionId]);

  // Запись изменения фильтра
  const trackFilterChange = useCallback(async (
    parameterName: string,
    previousValue: unknown,
    newValue: unknown
  ) => {
    if (!sessionId) return;

    const change: FilterChange = {
      timestamp: new Date().toISOString(),
      parameterName,
      previousValue,
      newValue,
      changeSource: 'user_input',
    };
    
    filterChanges.current.push(change);
    sessionMetrics.current.filtersChangedCount++;

    // Записываем событие
    await trackEvent('filter_change', change);

    // Обновляем сессию фильтров
    if (filterSessionId) {
      try {
        await fetch('/api/recommendations/filter-sessions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterSessionId,
            filterChanges: filterChanges.current,
          }),
        });
      } catch (err) {
        console.error('Error updating filter session:', err);
      }
    }
  }, [sessionId, filterSessionId, trackEvent]);

  // Отслеживание открытия модального окна
  const handleModalOpen = useCallback(() => {
    isModalOpen.current = true;
    sessionMetrics.current.modalOpenedCount++;
    trackEvent('action_click', {
      action: 'open_details',
      timeSinceShownMs: fetchStartTime.current ? Date.now() - fetchStartTime.current : 0,
    });
    trackSignal('element_visible', {
      elementType: 'overview',
      elementPosition: { x: 0, y: 0, viewportPercentage: 100 },
      elementVisibility: 1,
    });
  }, [trackEvent, trackSignal]);

  // Получение года из даты
  const getYear = (movieData: MovieData) => {
    const date = movieData.release_date || movieData.first_air_date;
    return date ? date.split('-')[0] : '—';
  };

  // Получение рекомендации с фильтрами
  const fetchRecommendation = useCallback(async (types: ContentType[], lists: ListType[], additionalFilters?: AdditionalFilters) => {
    // Записываем изменения фильтров если это не первый вызов
    if (currentFilters) {
      // Сравниваем типы
      if (JSON.stringify(currentFilters.types) !== JSON.stringify(types)) {
        trackFilterChange('contentTypes', currentFilters.types, types);
      }
      // Сравниваем списки
      if (JSON.stringify(currentFilters.lists) !== JSON.stringify(lists)) {
        trackFilterChange('lists', currentFilters.lists, lists);
      }
    }

    const isFirstCall = !fetchStartTime.current;
    if (isFirstCall) {
      fetchStartTime.current = Date.now();
      setProgress(0);
      startFilterSession();
    }

    // Обновляем текущие фильтры
    setCurrentFilters({ types, lists, additionalFilters });

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
      const fetchEndTime = Date.now();
      const fetchDuration = fetchEndTime - fetchStartTime.current;

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

        // Обновляем метрики сессии
        sessionMetrics.current.recommendationsShown++;

        // Записываем событие показа рекомендации
        await trackEvent('page_view', {
          page: 'recommendation_result',
          fetchDuration,
        });

        // Анимация progress bar
        if (fetchDuration < 3000) {
          const remainingTime = 3000 - fetchDuration;
          const steps = 20;
          const stepTime = remainingTime / steps;
          let currentProgress = 0;

          const progressInterval = setInterval(() => {
            currentProgress += (100 - currentProgress) / (steps - Math.floor(currentProgress / (100 / steps)));
            if (currentProgress >= 95) {
              clearInterval(progressInterval);
              setProgress(100);
              setViewState('result');
            } else {
              setProgress(Math.min(currentProgress, 95));
            }
          }, stepTime);
        } else {
          setProgress(100);
          setTimeout(() => setViewState('result'), 200);
        }
      } else {
        // Нет доступных рекомендаций
        setErrorMessage(data.message || 'Не удалось получить рекомендацию');
        if (data.message?.includes('Нет доступных рекомендаций') || 
            data.message?.includes('пуст') ||
            data.message?.includes('были показаны за последнюю неделю') ||
            data.message?.includes('показаны за последнюю неделю') ||
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
  }, [currentFilters, trackFilterChange, trackEvent]);

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
        fetchStartTime.current = 0;
        setViewState('filters');
        startFilterSession();
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
    // Записываем событие возврата к фильтрам
    if (logId) {
      trackEvent('action_click', {
        action: 'back_to_filters',
        timeSinceShownMs: fetchStartTime.current ? Date.now() - fetchStartTime.current : 0,
      });
    }

    fetchStartTime.current = 0;
    setViewState('filters');
    setMovie(null);
    setLogId(null);
    setUserStatus(null);
    setIsAnime(false);
    setCineChanceRating(null);
    setCineChanceVoteCount(0);
    setUserRating(null);
    setWatchCount(0);
    isModalOpen.current = false;
    startFilterSession();
  };

  // Записать действие пользователя
  const recordAction = useCallback(async (action: string) => {
    if (!logId) return null;

    try {
      const res = await fetch(`/api/recommendations/${logId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data: ActionResponse = await res.json();
      return data;
    } catch (err) {
      console.error('Error recording action:', err);
      return null;
    }
  }, [logId]);

  // Обработчик "Пропустить"
  const handleSkip = async () => {
    if (actionLoading || !logId) return;

    setActionLoading(true);
    
    // Записываем событие пропуска
    await trackEvent('action_click', {
      action: 'skip',
      timeSinceShownMs: fetchStartTime.current ? Date.now() - fetchStartTime.current : 0,
    });
    
    // Записываем негативную обратную связь (автоматически как "not_interested")
    await fetch('/api/recommendations/negative-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        recommendationLogId: logId,
        feedbackType: 'not_interested',
        contextualFactors: {
          timeOfDay: new Date().getHours(),
          sessionDuration: sessionStartTime.current ? Date.now() - sessionStartTime.current : 0,
          recommendationsInSession: sessionMetrics.current.recommendationsShown,
        },
      }),
    }).catch(() => {});

    sessionMetrics.current.actionsCount++;
    sessionMetrics.current.recommendationsSkipped++;

    await recordAction('skipped');
    fetchStartTime.current = 0;
    await fetchRecommendation(['movie', 'tv', 'anime'], ['want', 'watched']);
    setActionLoading(false);
  };

  // Обработчик "Отлично! Посмотрю"
  const handleAccept = async () => {
    if (actionLoading || !logId || !movie) return;

    setActionLoading(true);

    // Записываем событие принятия
    await trackEvent('action_click', {
      action: 'accept',
      timeSinceShownMs: fetchStartTime.current ? Date.now() - fetchStartTime.current : 0,
    });

    sessionMetrics.current.actionsCount++;
    sessionMetrics.current.recommendationsAccepted++;

    await recordAction('accepted');

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

  // Проверка: нужно ли показать popup о просмотре (пришел с рекомендаций)
  useEffect(() => {
    const acceptedData = sessionStorage.getItem('recommendationAccepted');
    if (acceptedData) {
      sessionStorage.removeItem('recommendationAccepted');
    }
  }, []);

  // Передаем обработчик открытия модального окна в дочерние компоненты
  const handleInfoClick = useCallback(() => {
    if (!isModalOpen.current) {
      handleModalOpen();
    }
  }, [handleModalOpen]);

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-3 sm:px-4 py-4">
        {/* Заголовок */}
        <h1 className="text-base sm:text-lg font-medium text-white mb-6">
          Что посмотреть?
        </h1>

        {/* Состояние: Фильтры */}
        {viewState === 'filters' && (
          <FilterForm
            onSubmit={(types, lists, additionalFilters) => fetchRecommendation(types as ContentType[], lists as ListType[], additionalFilters)}
            isLoading={false}
            onTypeChange={(types) => {
              if (currentFilters) {
                trackFilterChange('contentTypes', currentFilters.types, types);
              }
            }}
            onListChange={(lists) => {
              if (currentFilters) {
                trackFilterChange('lists', currentFilters.lists, lists);
              }
            }}
            onAdditionalFilterChange={(filters) => {
              if (currentFilters && currentFilters.additionalFilters) {
                // Отслеживаем изменения отдельных параметров
                if (currentFilters.additionalFilters.minRating !== filters.minRating) {
                  trackFilterChange('minRating', currentFilters.additionalFilters.minRating, filters.minRating);
                }
                if (currentFilters.additionalFilters.maxRating !== filters.maxRating) {
                  trackFilterChange('maxRating', currentFilters.additionalFilters.maxRating, filters.maxRating);
                }
                if (currentFilters.additionalFilters.yearFrom !== filters.yearFrom) {
                  trackFilterChange('yearFrom', currentFilters.additionalFilters.yearFrom, filters.yearFrom);
                }
                if (currentFilters.additionalFilters.yearTo !== filters.yearTo) {
                  trackFilterChange('yearTo', currentFilters.additionalFilters.yearTo, filters.yearTo);
                }
                if (JSON.stringify(currentFilters.additionalFilters.selectedGenres) !== JSON.stringify(filters.selectedGenres)) {
                  trackFilterChange('selectedGenres', currentFilters.additionalFilters.selectedGenres, filters.selectedGenres);
                }
              }
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
  );
}
