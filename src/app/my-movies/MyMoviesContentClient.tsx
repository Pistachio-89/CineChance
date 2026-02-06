'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
const RatingModal = dynamic(() => import('../components/RatingModal'), { ssr: false });
import FilmGridWithFilters, { FilmGridFilters } from '@/app/components/FilmGridWithFilters';
import { getMoviesCounts, updateWatchStatus } from './actions';
import { getUserTags } from '../actions/tagsActions';
import { Media } from '@/lib/tmdb';

interface MyMoviesContentClientProps {
  userId: string;
  initialTab?: 'watched' | 'wantToWatch' | 'dropped' | 'hidden';
  initialCounts: {
    watched: number;
    wantToWatch: number;
    dropped: number;
    hidden: number;
  };
}

interface AcceptedRecommendation {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: string;
  logId: string;
}

const STATUS_MAP: Record<string, 'want' | 'watched' | 'dropped' | 'rewatched' | null> = {
  'Хочу посмотреть': 'want',
  'Просмотрено': 'watched',
  'Брошено': 'dropped',
  'Пересмотрено': 'rewatched',
};

export default function MyMoviesContentClient({
  userId,
  initialTab = 'watched',
  initialCounts,
}: MyMoviesContentClientProps) {
  const [activeTab, setActiveTab] = useState<'watched' | 'wantToWatch' | 'dropped' | 'hidden'>(
    initialTab
  );
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [userTags, setUserTags] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [currentCounts, setCurrentCounts] = useState(initialCounts);

  // Popup state
  const [showWatchedPopup, setShowWatchedPopup] = useState(false);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState<AcceptedRecommendation | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Загружаем доступные жанры и теги пользователя
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { getUserGenres } = await import('./actions');
        const genres = await getUserGenres(userId);
        setAvailableGenres(genres);
      } catch (error) {
        console.error('Error fetching genres:', error);
      }

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
        console.error('Error fetching tags:', error);
      }
    };

    fetchData();
  }, [userId]);

  // Проверка: пришел ли пользователь со страницы рекомендаций
  useEffect(() => {
    const recommendationData = sessionStorage.getItem('recommendationAccepted');
    if (recommendationData) {
      try {
        const data = JSON.parse(recommendationData) as AcceptedRecommendation;
        setAcceptedRecommendation(data);
        setShowWatchedPopup(true);
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

  // Обработчик сохранения оценки
  const handleRatingSave = async (rating: number, _date: string) => {
    if (!acceptedRecommendation) return;

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

      const newCounts = await getMoviesCounts(userId);
      setCurrentCounts(newCounts);
    } catch (error) {
      console.error('Error updating watch status:', error);
    } finally {
      setShowRatingModal(false);
      setAcceptedRecommendation(null);
    }
  };

  const fetchMovies = useCallback(
    async (page: number, filters: FilmGridFilters) => {
      try {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(20));
        
        // Добавляем типы контента
        const types: string[] = [];
        if (filters.showMovies) types.push('movie');
        if (filters.showTv) types.push('tv');
        if (filters.showAnime) types.push('anime');
        if (types.length > 0 && types.length < 3) {
          params.append('types', types.join(','));
        }
        
        // Добавляем сортировку
        params.append('sortBy', filters.sortBy);
        params.append('sortOrder', filters.sortOrder);
        
        // Добавляем рейтинг
        if (filters.minRating > 0) {
          params.append('minRating', String(filters.minRating));
        }
        if (filters.maxRating < 10) {
          params.append('maxRating', String(filters.maxRating));
        }
        
        // Добавляем год
        if (filters.yearFrom) {
          params.append('yearFrom', filters.yearFrom);
        }
        if (filters.yearTo) {
          params.append('yearTo', filters.yearTo);
        }
        
        // Добавляем жанры
        if (filters.genres?.length) {
          params.append('genres', filters.genres.join(','));
        }
        
        // Добавляем теги
        if (filters.tags?.length) {
          params.append('tags', filters.tags.join(','));
        }

        // Добавляем статус в зависимости от вкладки
        if (activeTab === 'watched') {
          params.append('statusName', 'Просмотрено,Пересмотрено');
        } else if (activeTab === 'wantToWatch') {
          params.append('statusName', 'Хочу посмотреть');
        } else if (activeTab === 'dropped') {
          params.append('statusName', 'Брошено');
        } else if (activeTab === 'hidden') {
          params.append('includeHidden', 'true');
        }

        const response = await fetch(`/api/my-movies?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch movies');

        const data = await response.json();
        
        return {
          movies: data.movies || [],
          hasMore: data.hasMore || false,
        };
      } catch (error) {
        console.error('Error fetching movies:', error);
        return { movies: [], hasMore: false };
      }
    },
    [activeTab]
  );

  const tabs = [
    { id: 'watched' as const, label: 'Просмотрено', count: currentCounts.watched },
    { id: 'wantToWatch' as const, label: 'Хочу посмотреть', count: currentCounts.wantToWatch },
    { id: 'dropped' as const, label: 'Брошено', count: currentCounts.dropped },
    {
      id: 'hidden' as const,
      label: 'Скрытые',
      count: currentCounts.hidden,
      className: 'text-gray-500 hover:text-gray-400'
    },
  ];

  const isRestoreView = activeTab === 'hidden';

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

      {/* RatingModal */}
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">
          Мои фильмы
        </h1>

        <div className="flex flex-wrap gap-4 mb-8 border-b border-gray-800 pb-2">
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
                onClick={() => setActiveTab(tab.id)}
                className={baseClasses}
              >
                <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                <span className="ml-2 text-xs sm:text-sm">({tab.count})</span>
              </button>
            );
          })}
        </div>

        <FilmGridWithFilters
          fetchMovies={fetchMovies}
          availableGenres={availableGenres}
          userTags={userTags}
          showRatingBadge={true}
          getInitialRating={(movie) => (movie as any).userRating}
          initialStatus={isRestoreView ? null : 'watched'}
          emptyMessage={
            isRestoreView
              ? 'Добавляйте фильмы в черный список на главной странице'
              : 'В этом списке пока ничего нет'
          }
        />
      </div>
    </div>
  );
}
