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
  message?: string;
}

interface ActionResponse {
  success: boolean;
  message: string;
  logId: string;
}

interface RecommendationsClientProps {
  userId: string;
}

type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

type ViewState = 'filters' | 'loading' | 'result' | 'error';

export default function RecommendationsClient({ userId }: RecommendationsClientProps) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>('filters');
  const [movie, setMovie] = useState<MovieData | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<'want' | 'watched' | 'dropped' | 'rewatched' | null>(null);
  const [isAnime, setIsAnime] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noAvailable, setNoAvailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  
  const fetchStartTime = useRef<number>(0);

  // Получение года из даты
  const getYear = (movieData: MovieData) => {
    const date = movieData.release_date || movieData.first_air_date;
    return date ? date.split('-')[0] : '—';
  };

  // Получение рекомендации с фильтрами
  const fetchRecommendation = useCallback(async (types: ContentType[], lists: ListType[]) => {
    const isFirstCall = !fetchStartTime.current;
    if (isFirstCall) {
      fetchStartTime.current = Date.now();
      setProgress(0);
    }

    setViewState('loading');
    setErrorMessage(null);
    setNoAvailable(false);
    setMovie(null);
    setUserStatus(null);
    setIsAnime(false);

    try {
      // Формируем URL с параметрами фильтров
      const params = new URLSearchParams();
      params.set('types', types.join(','));
      params.set('lists', lists.join(','));
      
      const res = await fetch(`/api/recommendations/random?${params.toString()}`);
      const data: RecommendationResponse = await res.json();
      const fetchEndTime = Date.now();
      const fetchDuration = fetchEndTime - fetchStartTime.current;

      if (data.success && data.movie) {
        setMovie(data.movie);
        setLogId(data.logId);
        setUserStatus(data.userStatus);
        
        // Проверка на аниме
        const isAnimeCheck = (data.movie.genre_ids?.includes(16) || data.movie.genres?.some(g => g.id === 16)) && 
                            data.movie.original_language === 'ja';
        setIsAnime(isAnimeCheck);

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
        if (data.message?.includes('Нет доступных рекомендаций') || data.message?.includes('пуст')) {
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
    if (!confirm('Вы уверены? Это удалит всю историю показов рекомендаций.')) return;

    try {
      const res = await fetch('/api/recommendations/reset-logs', {
        method: 'POST',
      });

      if (res.ok) {
        alert('История рекомендаций очищена! Теперь можно получить новые рекомендации.');
        fetchStartTime.current = 0;
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
    fetchStartTime.current = 0;
    setViewState('filters');
    setMovie(null);
    setLogId(null);
    setUserStatus(null);
    setIsAnime(false);
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
    await recordAction('skipped');
    fetchStartTime.current = 0;
    await fetchRecommendation(['movie', 'tv', 'anime'], ['want', 'watched']);
    setActionLoading(false);
  };

  // Обработчик "Отлично! Посмотрю"
  const handleAccept = async () => {
    if (actionLoading || !logId || !movie) return;

    setActionLoading(true);
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
            onSubmit={(types, lists) => fetchRecommendation(types as ContentType[], lists as ListType[])}
            isLoading={false}
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

        {/* Состояние: Результат */}
        {viewState === 'result' && movie && (
          <div className="animate-in fade-in duration-300">
            <RecommendationCard
              movie={movie}
              userStatus={userStatus}
              isAnime={isAnime}
              actionLoading={actionLoading}
              onSkip={handleSkip}
              onAccept={handleAccept}
            />
          </div>
        )}
      </div>
    </div>
  );
}
