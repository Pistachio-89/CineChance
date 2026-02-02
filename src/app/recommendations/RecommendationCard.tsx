'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ImageWithProxy from '@/app/components/ImageWithProxy';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { STATIC_BLUR_PLACEHOLDER } from '@/lib/blurPlaceholder';
const RecommendationInfoModal = dynamic(() => import('./RecommendationInfoModal'), { ssr: false });

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

type MediaStatus = 'want' | 'watched' | 'dropped' | 'rewatched' | null;

interface RecommendationCardProps {
  movie: MovieData;
  userStatus: MediaStatus;
  isAnime: boolean;
  actionLoading: boolean;
  onSkip: () => void;
  onAccept: () => void;
  cineChanceRating: number | null;
  cineChanceVoteCount: number;
  userRating: number | null;
  watchCount: number;
  onResetFilters?: () => void;
  onBack?: () => void;
  onInfoClick?: () => void;
}

// Получение года из даты
function getYear(movieData: MovieData): string {
  const date = movieData.release_date || movieData.first_air_date;
  return date ? date.split('-')[0] : '—';
}

// Иконка статуса - отображаем для всех статусов
function getStatusIcon(status: MediaStatus) {
  switch (status) {
    case 'want':
      return (
        <div className="absolute top-2 right-2 z-10 bg-white rounded-full p-1.5 shadow-lg">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-blue-500 text-lg font-bold leading-none" style={{ marginTop: '-1px' }}>+</span>
          </div>
        </div>
      );
    case 'watched':
      return (
        <div className="absolute top-2 right-2 z-10 bg-green-500 rounded-full p-1.5 shadow-lg">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-white text-sm font-bold leading-none" style={{ marginTop: '-1px' }}>✓</span>
          </div>
        </div>
      );
    case 'dropped':
      return (
        <div className="absolute top-2 right-2 z-10 bg-red-500 rounded-full p-1.5 shadow-lg">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-white text-base font-bold leading-none flex items-center justify-center h-full">×</span>
          </div>
        </div>
      );
    case 'rewatched':
      return (
        <div className="absolute top-2 right-2 z-10 bg-purple-500 rounded-full p-1.5 shadow-lg">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-white text-sm font-bold leading-none" style={{ marginTop: '-1px' }}>↻</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function RecommendationCard({
  movie,
  userStatus,
  isAnime,
  actionLoading,
  onSkip,
  onAccept,
  cineChanceRating,
  cineChanceVoteCount,
  userRating,
  watchCount,
  onResetFilters,
  onBack,
  onInfoClick,
}: RecommendationCardProps) {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imageError, setImageError] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hoverStartTime = useRef<number>(0);

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Отслеживание hover на элементах
  const handleHoverStart = useCallback((elementType: string) => {
    hoverStartTime.current = Date.now();
    // Здесь можно вызвать API для записи hover_start события
      // Hover tracking removed - performance optimization
  }, []);

  const handleHoverEnd = useCallback((elementType: string) => {
    if (hoverStartTime.current > 0) {
      const duration = Date.now() - hoverStartTime.current;
      // Записываем duration если больше порога (например, 500мс)
      if (duration > 500) {
      // Hover end tracking removed - performance optimization
        // Здесь можно вызвать API для записи события
      }
    }
    hoverStartTime.current = 0;
  }, []);

  // Определяем отображаемый тип контента
  const displayType = isAnime ? 'anime' : (movie.media_type === 'movie' ? 'movie' : 'tv');
  const typeLabel = isAnime ? 'Аниме' : (movie.media_type === 'movie' ? 'Фильм' : 'Сериал');
  const typeColor = isAnime ? 'bg-[#9C40FE]' : (movie.media_type === 'movie' ? 'bg-green-500' : 'bg-blue-500');

  // Формируем данные для модального окна
  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const genres = movie.genres?.map(g => g.name) || [];
  const productionCountries = movie.production_countries?.map(c => c.name) || [];
  const combinedRating = movie.vote_average; // В контексте рекомендаций используем TMDB рейтинг как общий

  const handleCardInfoClick = () => {
    setIsInfoModalOpen(true);
    if (onInfoClick) {
      onInfoClick();
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <>
      <div className="max-w-xs mx-auto animate-in fade-in duration-300">
        {/* Тип фильма над постером */}
        <div className={`${typeColor} text-white text-sm font-semibold px-2 py-1.5 rounded-t-lg w-full text-center`}>
          {typeLabel}
        </div>
        
        {/* Постер */}
        <div 
          ref={posterRef}
          onClick={handleCardInfoClick}
          onMouseEnter={() => handleHoverStart('poster')}
          onMouseLeave={() => handleHoverEnd('poster')}
          className={`relative w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden shadow-lg cursor-pointer`}
        >
          {movie.poster_path ? (
            <ImageWithProxy
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title || movie.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 33vw"
              quality={85}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <svg 
                className="w-1/2 h-1/2 text-gray-600"
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          
          {/* Иконка статуса в правом верхнем углу */}
          {getStatusIcon(userStatus)}
        </div>

        {/* Информация под постером - прозрачный фон */}
        <div 
          ref={titleRef}
          className="cursor-pointer rounded-b-lg"
          onClick={handleCardInfoClick}
          onMouseEnter={() => handleHoverStart('title')}
          onMouseLeave={() => handleHoverEnd('title')}
        >
          {/* Заголовок с названием фильма и годом в одной строке */}
          <div className={`flex items-center justify-between gap-2 text-white`}>
            <h3 className={`text-sm sm:text-base font-semibold flex-1 min-w-0 overflow-hidden`} style={{ 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>
              {movie.title || movie.name}
            </h3>
            <div className="text-xs text-gray-400 flex-shrink-0">
              {getYear(movie)}
            </div>
          </div>
          
          {/* Блок с "Подробнее" и рейтингом */}
          <div className="flex items-center justify-between mt-1 w-full">
            {/* Кнопка "Подробнее" слева - без отступов */}
            <div className="text-sm py-1 text-gray-400 pl-0">
              Подробнее
            </div>
            
            {/* Рейтинг справа - без отступов */}
            <div className="flex items-center rounded text-sm relative pr-0"> {/* Убрал bg-gray-800/50 */}
              <div className="w-5 h-5 relative mx-1">
                  <Image 
                      src="/images/logo_mini_lgt_pls_tmdb.png" 
                      alt="TMDB Logo" 
                      fill 
                      className="object-contain" 
                  />
              </div>
              <span className="text-gray-200 font-medium">
                {movie.vote_average.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2 mt-3">
          {/* Не хочу! Следующий */}
          <button
            onClick={onSkip}
            disabled={actionLoading}
            className="flex-1 py-2.5 px-3 bg-red-600/20 border border-red-500/30 text-red-400 text-sm rounded-lg font-medium hover:bg-red-600/30 transition disabled:opacity-50 cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold leading-tight">Не хочу!</span>
              <span className="text-xs font-normal mt-0.5 opacity-90">Следующий</span>
            </div>
          </button>

          {/* Отлично! Посмотрю */}
          <button
            onClick={onAccept}
            disabled={actionLoading}
            className="flex-1 py-2.5 px-3 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-500 transition disabled:opacity-50 cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold leading-tight">Отлично!</span>
              <span className="text-xs font-normal mt-0.5 opacity-90">Посмотрю</span>
            </div>
          </button>
        </div>

        {/* Кнопка сброса фильтров */}
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            disabled={actionLoading}
            className="w-full mt-2 py-2 px-3 bg-gray-700/50 border border-gray-600/30 text-gray-400 text-sm rounded-lg font-medium hover:bg-gray-700 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Модальное окно с подробной информацией */}
      <RecommendationInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title={title}
        tmdbRating={movie.vote_average}
        tmdbVoteCount={movie.vote_count}
        cineChanceRating={cineChanceRating}
        cineChanceVoteCount={cineChanceVoteCount}
        combinedRating={combinedRating}
        overview={movie.overview}
        releaseDate={releaseDate || undefined}
        genres={genres}
        runtime={movie.runtime}
        productionCountries={productionCountries}
        mediaType={displayType}
        isAnime={isAnime}
        isMobile={isMobile}
        tmdbId={movie.id}
        userRating={userRating}
        watchCount={watchCount}
        currentStatus={userStatus}
        movie={movie}
      />
    </>
  );
}