// src/app/components/MovieCard.tsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Media } from '@/lib/tmdb';
import RatingModal from './RatingModal';
import RatingInfoModal from './RatingInfoModal';
import { calculateCineChanceScore } from '@/lib/calculateCineChanceScore';

const RATING_TEXTS: Record<number, string> = {
  1: 'Хуже некуда',
  2: 'Ужасно',
  3: 'Очень плохо',
  4: 'Плохо',
  5: 'Более-менее',
  6: 'Нормально',
  7: 'Хорошо',
  8: 'Отлично',
  9: 'Великолепно',
  10: 'Эпик вин!',
};

type MediaStatus = 'want' | 'watched' | 'dropped' | null;

interface MovieCardProps {
  movie: Media;
  restoreView?: boolean;
  initialIsBlacklisted?: boolean;
  initialStatus?: MediaStatus;
  showRatingBadge?: boolean;
  priority?: boolean;
}

export default function MovieCard({ movie, restoreView = false, initialIsBlacklisted, initialStatus, showRatingBadge = false, priority = false }: MovieCardProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [status, setStatus] = useState<MediaStatus>(initialStatus ?? null);
  const [isBlacklisted, setIsBlacklisted] = useState<boolean>(initialIsBlacklisted ?? false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fanartPoster, setFanartPoster] = useState<string | null>(null);
  const [isTryingFanart, setIsTryingFanart] = useState(false);
  
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false);
  const [cineChanceRating, setCineChanceRating] = useState<number | null>(null);
  const [cineChanceVoteCount, setCineChanceVoteCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'watched' | 'dropped' | null>(null);
  const [movieDetails, setMovieDetails] = useState<{
    genres: string[];
    runtime: number;
    adult: boolean;
    productionCountries: string[];
    seasonNumber: string | null;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const imageUrl = useMemo(() => {
    if (imageError) return '/placeholder-poster.svg';
    if (fanartPoster) return fanartPoster;
    if (movie.poster_path) return `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
    return '/placeholder-poster.svg';
  }, [imageError, fanartPoster, movie.poster_path]);
  
  const title = movie.title || movie.name || 'Без названия';
  const date = movie.release_date || movie.first_air_date;
  const year = date ? date.split('-')[0] : '—';

  // Вычисляем взвешенный рейтинг Cine-chance
  const combinedRating = useMemo(() => {
    return calculateCineChanceScore({
      tmdbRating: movie.vote_average || 0,
      tmdbVotes: movie.vote_count || 0,
      cineChanceRating,
      cineChanceVotes: cineChanceVoteCount,
    });
  }, [movie.vote_average, movie.vote_count, cineChanceRating, cineChanceVoteCount]);

  const handlePosterError = async () => {
    if (!isTryingFanart && !fanartPoster && movie.poster_path) {
      setIsTryingFanart(true);
      try {
        const res = await fetch(`/api/fanart-poster?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
        if (res.ok) {
          const data = await res.json();
          if (data.poster) {
            setFanartPoster(data.poster);
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching Fanart.tv poster:', error);
      }
    }
    setImageError(true);
  };

  useEffect(() => {
    if (restoreView) {
      setIsBlacklisted(true); 
      return;
    }

    const fetchData = async () => {
      try {
        if (initialStatus === undefined) {
          const statusRes = await fetch(`/api/watchlist?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
          if (statusRes.ok) {
            const data = await statusRes.json();
            setStatus(data.status);
            setUserRating(data.userRating);
          }
        }

        if (initialIsBlacklisted === undefined) {
          const blacklistRes = await fetch(`/api/blacklist?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
          if (blacklistRes.ok) {
            const data = await blacklistRes.json();
            setIsBlacklisted(data.isBlacklisted);
          }
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    fetchData();
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [movie.id, movie.media_type, restoreView, initialIsBlacklisted, initialStatus]);

  // Получаем детали фильма при открытии модального окна рейтинга
  useEffect(() => {
    if (!isRatingInfoOpen) {
      setMovieDetails(null);
      return;
    }

    const fetchMovieDetails = async () => {
      try {
        const res = await fetch(`/api/movie-details?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
        
        if (res.ok) {
          const data = await res.json();
          setMovieDetails({
            genres: data.genres || [],
            runtime: data.runtime || 0,
            adult: data.adult || false,
            productionCountries: data.productionCountries || [],
            seasonNumber: data.seasonNumber || null,
          });
        }
      } catch (error) {
        console.error('Error fetching movie details:', error);
      }
    };

    fetchMovieDetails();
  }, [isRatingInfoOpen, movie.id, movie.media_type]);

  // Получаем средний рейтинг Cine-chance
  useEffect(() => {
    const fetchAverageRating = async () => {
      try {
        const res = await fetch(`/api/cine-chance-rating?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
        if (res.ok) {
          const data = await res.json();
          setCineChanceRating(data.averageRating);
          setCineChanceVoteCount(data.count || 0);
        }
      } catch (error) {
        console.error('Error fetching average rating:', error);
      }
    };
    
    fetchAverageRating();
  }, [movie.id, movie.media_type]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node) &&
        posterRef.current &&
        !posterRef.current.contains(event.target as Node) &&
        showOverlay
      ) {
        setShowOverlay(false);
      }
    };

    if (showOverlay) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverlay]);

  // Обработчик для клика на всю нижнюю часть карточки
  const handleCardInfoClick = (e: React.MouseEvent) => {
    // Предотвращаем всплытие, чтобы не перекрывать другие клики
    e.stopPropagation();
    setIsRatingInfoOpen(true);
  };

  const handleSaveRating = (rating: number, date: string) => {
    const saveStatus = async () => {
      try {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tmdbId: movie.id,
            mediaType: movie.media_type,
            status: pendingStatus,
            title: title,
            voteAverage: movie.vote_average,
            userRating: rating,
            watchedDate: date,
          }),
        });
        
        if (res.ok) {
          setStatus(pendingStatus);
          setUserRating(rating);
          setIsRatingModalOpen(false);
          setPendingStatus(null);
        } else {
          alert('Ошибка сохранения');
        }
      } catch (error) {
        console.error('Network error', error);
        alert('Ошибка сети');
      }
    };
    
    saveStatus();
  };

  const handleStatusChange = async (newStatus: MediaStatus) => {
    if (newStatus === 'watched' || newStatus === 'dropped') {
      setPendingStatus(newStatus);
      setIsRatingModalOpen(true);
      setShowOverlay(false);
      return;
    }

    const oldStatus = status;
    setStatus(newStatus);
    setShowOverlay(false);

    try {
      const res = await fetch('/api/watchlist', {
        method: newStatus === null ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: movie.id,
          mediaType: movie.media_type,
          status: newStatus,
          title: title,
          voteAverage: movie.vote_average,
        }),
      });
      if (!res.ok) setStatus(oldStatus);
    } catch (error) {
      setStatus(oldStatus);
    }
  };

  const handleBlacklistToggle = async () => {
    const method = restoreView ? 'DELETE' : (isBlacklisted ? 'DELETE' : 'POST');
    const targetState = restoreView ? false : !isBlacklisted;

    try {
      const res = await fetch('/api/blacklist', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: movie.id,
          mediaType: movie.media_type,
        }),
      });

      if (res.ok) {
        if (restoreView) {
          setIsRemoved(true);
        } else {
          setIsBlacklisted(targetState);
          setShowOverlay(false);
        }
      }
    } catch (error) {
      console.error('Network error', error);
    }
  };

  const getStatusIcon = () => {
    if (restoreView || isBlacklisted) {
      return (
        <div className="absolute top-2 right-2 z-10 bg-gray-800 rounded-full p-1.5 shadow-lg border border-gray-600">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-gray-300 text-sm font-bold">🚫</span>
          </div>
        </div>
      );
    }

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
      default:
        return null;
    }
  };

  const handlePosterClick = () => {
    if (isMobile) {
      setShowOverlay(!showOverlay);
    }
  };
  
  const handlePosterMouseEnter = () => { 
    if (!isMobile) {
      setIsHovered(true);
      setShowOverlay(true);
    }
  };
  
  const handlePosterMouseLeave = (e: React.MouseEvent) => { 
    if (!isMobile) {
      const relatedTarget = e.relatedTarget;
      try {
        if (relatedTarget instanceof Node && overlayRef.current?.contains(relatedTarget)) {
          return;
        }
      } catch (error) {
        // relatedTarget не является Node
      }
      setIsHovered(false);
      setShowOverlay(false);
    }
  };

  const handleOverlayMouseLeave = (e: React.MouseEvent) => {
    if (!isMobile) {
      const relatedTarget = e.relatedTarget;
      try {
        if (relatedTarget instanceof Node && posterRef.current?.contains(relatedTarget)) {
          return;
        }
      } catch (error) {
        // relatedTarget не является Node
      }
      setIsHovered(false);
      setShowOverlay(false);
    }
  };

  if (isRemoved) {
    return (
      <div className="w-full h-[200px] sm:h-[300px] border border-dashed border-gray-700 rounded-lg flex items-center justify-center">
        <span className="text-gray-600 text-sm">Удалено из списка</span>
      </div>
    );
  }

  return (
    <>
      <RatingModal 
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          setPendingStatus(null);
        }}
        onSave={handleSaveRating}
        title={title}
        releaseDate={movie.release_date || movie.first_air_date || null}
        userRating={userRating}
        defaultRating={pendingStatus === 'dropped' ? 2 : 6}
      />

      <RatingInfoModal
        isOpen={isRatingInfoOpen}
        onClose={() => setIsRatingInfoOpen(false)}
        title={title}
        tmdbRating={movie.vote_average || 0}
        tmdbVoteCount={movie.vote_count || 0}
        cineChanceRating={cineChanceRating}
        cineChanceVoteCount={cineChanceVoteCount}
        combinedRating={combinedRating}
        overview={movie.overview}
        releaseDate={movie.release_date || movie.first_air_date}
        genres={movieDetails?.genres}
        runtime={movieDetails?.runtime}
        adult={movieDetails?.adult}
        productionCountries={movieDetails?.productionCountries}
        seasonNumber={movieDetails?.seasonNumber}
        mediaType={movie.media_type}
        currentStatus={status}
        onStatusChange={(newStatus) => {
          handleStatusChange(newStatus);
          setIsRatingInfoOpen(false);
        }}
        isMobile={isMobile}
      />

      <div 
        ref={cardRef}
        className="w-full h-full min-w-0 relative"
      >
        <div className="relative">
          <div className={`${movie.media_type === 'movie' ? 'bg-green-500' : 'bg-blue-500'} text-white text-xs font-semibold px-2 py-1.5 rounded-t-lg w-full text-center`}>
            {movie.media_type === 'movie' ? 'Фильм' : 'Сериал'}
          </div>
          
          <div 
            ref={posterRef}
            className={`relative w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-b-lg overflow-hidden shadow-lg transition-all duration-300 ${
              restoreView || isBlacklisted 
                ? 'opacity-60 grayscale hover:opacity-80 hover:grayscale-0' 
                : isHovered && !showOverlay ? 'shadow-xl' : ''
            } ${showOverlay ? 'cursor-default' : 'cursor-pointer'}`}
            onClick={handlePosterClick}
            onMouseEnter={handlePosterMouseEnter}
            onMouseLeave={handlePosterMouseLeave}
          >
            
            {getStatusIcon()}

            <Image
              src={imageUrl}
              alt={title}
              fill
              className={`object-cover transition-transform duration-500 ${
                isHovered && !showOverlay ? 'scale-105' : ''
              }`}
              sizes="(max-width: 640px) 48vw, (max-width: 768px) 31vw, (max-width: 1024px) 23vw, (max-width: 1280px) 19vw, 15vw"
              loading={priority ? "eager" : "lazy"}
              onError={handlePosterError}
            />
          </div>

          {showOverlay && (
            <div 
              ref={overlayRef}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 sm:p-3 z-50 rounded-lg"
              onMouseLeave={handleOverlayMouseLeave}
            >
              <div className="w-full max-w-[140px] sm:max-w-[150px] space-y-1">
                {restoreView ? (
                  <button
                    onClick={handleBlacklistToggle}
                    className="w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer bg-orange-100 text-orange-800 hover:bg-orange-200 hover:text-orange-900"
                  >
                    <span className="text-base font-bold min-w-[16px] flex justify-center mr-1.5">🔓</span>
                    <span className="truncate">Разблокировать</span>
                  </button>
                ) : (
                  <>
                    {isBlacklisted ? (
                      <button
                        onClick={handleBlacklistToggle}
                        className="w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer bg-orange-100 text-orange-800 hover:bg-orange-200 hover:text-orange-900"
                      >
                        <span className="text-base font-bold min-w-[16px] flex justify-center mr-1.5">🔓</span>
                        <span className="truncate">Разблокировать</span>
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleStatusChange('want')} className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${status === 'want' ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                          <span className="text-base font-bold min-w-[16px] flex justify-center mr-1.5">+</span>
                          <span className="truncate">Хочу посмотреть</span>
                        </button>
                        
                        <button 
                          onClick={() => handleStatusChange('watched')} 
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${status === 'watched' ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                          <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">✓</span>
                          <span className="truncate">Просмотрено</span>
                        </button>
                        
                        <button onClick={() => handleStatusChange('dropped')} className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${status === 'dropped' ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                          <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">×</span>
                          <span className="truncate">Брошено</span>
                        </button>

                        <div className="h-px bg-gray-700 my-1"></div>

                        <button
                          onClick={handleBlacklistToggle}
                          className="w-full py-1 px-2 rounded-lg text-[10px] sm:text-xs font-medium bg-gray-800/80 text-gray-400 hover:bg-red-900/50 hover:text-red-300 transition-colors flex items-center justify-start text-left cursor-pointer"
                        >
                          <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">🚫</span>
                          <span className="truncate">В черный список</span>
                        </button>

                        {status && (
                          <button
                            onClick={() => handleStatusChange(null)}
                            className="w-full py-1 px-2 rounded-lg text-[10px] sm:text-xs font-medium bg-gray-800/50 text-gray-300 hover:bg-gray-800/70 mt-1 flex items-center justify-center cursor-pointer"
                          >
                            Убрать из списков
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Кликабельная область для открытия попапа с рейтингом */}
        <div 
          className="mt-1 cursor-pointer"
          onClick={handleCardInfoClick}
        >
          {/* Заголовок с названием фильма и годом в одной строке */}
          <div className={`flex items-center justify-between gap-2 ${isBlacklisted ? 'text-gray-500' : 'text-white'}`}>
            <h3 className={`text-xs sm:text-sm font-medium flex-1 min-w-0 overflow-hidden`} style={{ 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>
              {title}
            </h3>
            <div className="text-xs text-gray-400 flex-shrink-0">
              {year}
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-1 w-full">
            {/* Кнопка "Подробнее" слева - без отступов */}
            <div className="text-sm py-1 text-gray-400 hover:text-white transition-colors pl-0">
              Подробнее
            </div>
            
            {/* Рейтинг справа - без отступов */}
            <div className="flex items-center bg-gray-800/50 rounded text-sm relative pr-0">
              <div className="w-5 h-5 relative mx-1">
                  <Image 
                      src="/images/logo_mini_lgt_pls_tmdb.png" 
                      alt="TMDB Logo" 
                      fill 
                      className="object-contain" 
                  />
              </div>
              <span className="text-gray-200 font-medium">
                {combinedRating.toFixed(1)}
              </span>
            </div>
          </div>
          
          {/* Плашка с оценкой пользователя - НЕ входит в кликабельную область */}
          {showRatingBadge && (status === 'watched' || status === 'dropped') && (
            <div className={`mt-0 px-2 py-1.5 rounded-b-lg text-xs font-semibold w-full text-center ${userRating ? 'bg-blue-900/80' : 'bg-gray-800/80'} flex items-center`}>
              {userRating ? (
                <>
                  {/* Текст оценки - занимает все пространство кроме звезды */}
                  <div className="flex-1 text-center">
                    <span className="text-white font-medium">
                      {RATING_TEXTS[userRating]}
                    </span>
                  </div>
                  
                  {/* Звезда с цифрой - фиксированная позиция справа */}
                  <div className="relative w-8 h-8 ml-2 flex-shrink-0">
                    <svg 
                      width="32" 
                      height="32" 
                      viewBox="0 0 32 32" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute inset-0 w-full h-full"
                    >
                      {/* 5-лучевая звезда с увеличенным внутренним радиусом и желтым контуром */}
                      <path 
                        d="M16 2L21 10L29 12L24 18L24 27L16 24L8 27L8 18L3 12L11 10L16 2Z" 
                        stroke="#FFD700" 
                        strokeWidth="1.5" 
                        fill="none"
                      />
                    </svg>
                    
                    {/* Цифра оценки в центре звезды - опущена на 0.5px */}
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold z-10" style={{ transform: 'translateY(0.5px)' }}>
                      {userRating}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-gray-400 w-full">поставить оценку</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}