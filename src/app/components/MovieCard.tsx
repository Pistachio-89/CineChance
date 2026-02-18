// src/app/components/MovieCard.tsx
'use client';
 

import { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react';
import Image from 'next/image';
import { Media } from '@/lib/tmdb';
import RatingModal from './RatingModal';
import RatingInfoModal from './RatingInfoModal';
import { calculateCineChanceScore } from '@/lib/calculateCineChanceScore';
import { getMediaTypeDisplay } from '@/lib/mediaType';
import MoviePosterProxy from './MoviePosterProxy';
import StatusOverlay from './StatusOverlay';
import { logger } from '@/lib/logger';
import { useBlacklist } from './BlacklistContext';

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

type MediaStatus = 'want' | 'watched' | 'dropped' | 'rewatched' | null;

interface MovieCardProps {
  movie: Media;
  restoreView?: boolean;
  initialIsBlacklisted?: boolean;
  initialStatus?: MediaStatus;
  showRatingBadge?: boolean;
  priority?: boolean;
  initialUserRating?: number | null;
  initialWatchCount?: number;
  initialAverageRating?: number | null;
  initialRatingCount?: number;
}

export default function MovieCard({ 
  movie, 
  restoreView = false, 
  initialIsBlacklisted, 
  initialStatus, 
  showRatingBadge = false, 
  priority = false, 
  initialUserRating, 
  initialWatchCount, 
  initialAverageRating, 
  initialRatingCount 
}: MovieCardProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [status, setStatus] = useState<MediaStatus>(initialStatus ?? null);
  const [isBlacklisted, setIsBlacklisted] = useState<boolean>(initialIsBlacklisted ?? false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isRatingInfoOpen, setIsRatingInfoOpen] = useState(false);
  const [cineChanceRating, setCineChanceRating] = useState<number | null>(initialAverageRating ?? null);
  const [cineChanceVoteCount, setCineChanceVoteCount] = useState(initialRatingCount ?? 0);
  const [userRating, setUserRating] = useState<number | null>(initialUserRating ?? null);
  const [watchCount, setWatchCount] = useState(initialWatchCount ?? 0);
  const [pendingStatus, setPendingStatus] = useState<'watched' | 'dropped' | 'rewatched' | null>(null);
  const [pendingRewatch, setPendingRewatch] = useState<boolean>(false);
  const [isReratingOnly, setIsReratingOnly] = useState(false);
  
  const [movieDetails, setMovieDetails] = useState<{
    genres: string[];
    runtime: number;
    adult: boolean;
    productionCountries: string[];
    seasonNumber: string | null;
    isAnime: boolean;
    collectionName: string | null;
    collectionId: number | null;
    cast: {
      id: number;
      name: string;
      character: string;
      profilePath: string | null;
    }[];
  } | null>(null);

  const { checkBlacklist, isLoading: isBlacklistLoading } = useBlacklist();

  // Initialize isBlacklisted from context when it loads
  useEffect(() => {
    if (!isBlacklistLoading && initialIsBlacklisted === undefined) {
      setIsBlacklisted(checkBlacklist(movie.id));
    }
  }, [isBlacklistLoading, checkBlacklist, movie.id, initialIsBlacklisted]);

  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const title = movie.title || movie.name || 'Без названия';
  const date = movie.release_date || movie.first_air_date;
  const year = date ? date.split('-')[0] : '—';
  
  const mediaTypeConfig = useMemo(() => getMediaTypeDisplay(movie), [movie]);

  const combinedRating = useMemo(() => {
    return calculateCineChanceScore({
      tmdbRating: movie.vote_average || 0,
      tmdbVotes: movie.vote_count || 0,
      cineChanceRating,
      cineChanceVotes: cineChanceVoteCount,
    });
  }, [movie.vote_average, movie.vote_count, cineChanceRating, cineChanceVoteCount]);

  // Загрузка CineChance рейтинга при монтировании компонента
  useEffect(() => {
    if (!movie.id || !movie.media_type) return;

    const fetchCineChanceRating = async () => {
      try {
        const res = await fetch(`/api/cine-chance-rating?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
        if (res.ok) {
          const data = await res.json();
          if (data.averageRating !== undefined) {
            setCineChanceRating(data.averageRating);
          }
          if (data.count !== undefined) {
            setCineChanceVoteCount(data.count);
          }
        }
      } catch (error) {
        // Silently fail - CineChance rating is not critical functionality
      }
    };

    fetchCineChanceRating();
  }, [movie.id, movie.media_type]);

  useEffect(() => {
    if (restoreView) {
      setIsBlacklisted(true); 
      return;
    }

    const fetchData = async () => {
      try {
        if (initialStatus === undefined) {
          const statusRes = await fetch(`/api/watchlist?tmdbId=${movie.id}&mediaType=${movie.media_type}`);
          
          if (!statusRes.ok) {
            return;
          }
          
          const text = await statusRes.text();
          if (!text) return;
          
          const data = JSON.parse(text);
          setStatus(data.status);
          setUserRating(data.userRating);
          setWatchCount(data.watchCount || 0);
        }
      } catch {
        // Silently ignore watchlist fetch errors - user may not be authenticated
      }
    };

    if (initialStatus === undefined) {
      fetchData();
    }
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [movie.id, movie.media_type, restoreView, initialIsBlacklisted, initialStatus, isBlacklistLoading, checkBlacklist]);

  // Загрузка данных при открытии RatingInfoModal
  useEffect(() => {
    if (!isRatingInfoOpen) return;

    const fetchData = async () => {
      // Параллельная загрузка рейтинга и деталей фильма
      const promises: Promise<unknown>[] = [];

      // Загрузка рейтинга CineChance (если не передан)
      if (cineChanceRating === null && movie.id && movie.media_type) {
        promises.push(
          fetch(`/api/cine-chance-rating?tmdbId=${movie.id}&mediaType=${movie.media_type}`)
            .then(res => res.json())
            .then(data => {
              if (data.averageRating !== undefined) {
                setCineChanceRating(data.averageRating);
              }
              if (data.count !== undefined) {
                setCineChanceVoteCount(data.count);
              }
            })
            .catch(error => {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Failed to fetch CineChance rating', { 
                tmdbId: movie.id, 
                mediaType: movie.media_type, 
                error: errorMessage 
              });
            })
        );
      }

      // Загрузка деталей фильма (если ещё не загружены)
      if (!movieDetails && movie.id && movie.media_type) {
        promises.push(
          fetch(`/api/movie-details?tmdbId=${movie.id}&mediaType=${movie.media_type}`)
            .then(res => res.json())
            .then(data => {
              setMovieDetails({
                genres: data.genres || [],
                runtime: data.runtime || 0,
                adult: data.adult || false,
                productionCountries: data.productionCountries || [],
                seasonNumber: data.seasonNumber || null,
                isAnime: data.isAnime || false,
                collectionName: data.collectionName || null,
                collectionId: data.collectionId || null,
                cast: (data.cast || []).map((c: { id: number; name: string; character: string; profilePath: string | null }) => ({
                  id: c.id,
                  name: c.name,
                  character: c.character,
                  profilePath: c.profilePath
                }))
              });
            })
            .catch(error => {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Failed to fetch movie details', { 
                tmdbId: movie.id, 
                mediaType: movie.media_type, 
                error: errorMessage 
              });
            })
        );
      }

      await Promise.all(promises);
    };

    fetchData();
  }, [isRatingInfoOpen, movie.id, movie.media_type, cineChanceRating, movieDetails]);

  // Обработчик клика вне оверлея
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

    if (showOverlay) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverlay]);

  const handleCardInfoClick = (e: React.MouseEvent) => {
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
            status: isReratingOnly ? undefined : pendingStatus,
            title: title,
            voteAverage: movie.vote_average,
            userRating: rating,
            watchedDate: isReratingOnly ? undefined : date,
            isRewatch: isReratingOnly ? false : pendingRewatch,
            isRatingOnly: isReratingOnly,
          }),
        });
        
        if (res.ok) {
          setUserRating(rating);
          setIsRatingModalOpen(false);
          setPendingStatus(null);
          setPendingRewatch(false);
          setIsReratingOnly(false);
          
          if (pendingRewatch) {
            setStatus('rewatched');
            // НЕ увеличиваем watchCount здесь - API сам увеличивает счетчик при isRewatch
          } else if (pendingStatus === 'watched') {
            setStatus('watched');
          } else if (pendingStatus === 'dropped') {
            setStatus('dropped');
          }
        } else {
          alert('Ошибка сохранения');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Network error while saving rating', { tmdbId: movie.id, error: errorMessage });
        alert('Ошибка сети');
      }
    };
    
    saveStatus();
  };

  const handleStatusChange = async (newStatus: MediaStatus) => {
    // Для watched и rewatched - открываем модальное окно оценки
    if (newStatus === 'watched' || newStatus === 'dropped') {
      setPendingStatus(newStatus);
      setIsRatingModalOpen(true);
      setShowOverlay(false);
      return;
    }

    // Для rewatched через onStatusChange
    if (newStatus === 'rewatched') {
      setStatus(newStatus);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Network error while toggling blacklist', { 
        tmdbId: movie.id, 
        isBlacklisted: targetState, 
        error: errorMessage 
      });
    }
  };

  const getStatusIcon = () => {
    if (restoreView) {
      return (
        <div className="absolute top-2 right-2 z-10 bg-gray-800 rounded-full p-1.5 shadow-lg border border-gray-600">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-gray-300 text-sm font-bold">🚫</span>
          </div>
        </div>
      );
    }

    let statusIcon = null;
    switch (status) {
      case 'want':
        statusIcon = (
          <div className="absolute top-2 right-2 z-10 bg-white rounded-full p-1.5 shadow-lg">
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-blue-500 text-lg font-bold leading-none" style={{ marginTop: '-1px' }}>+</span>
            </div>
          </div>
        );
        break;
      case 'watched':
        statusIcon = (
          <div className="absolute top-2 right-2 z-10 bg-green-500 rounded-full p-1.5 shadow-lg">
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-white text-sm font-bold leading-none" style={{ marginTop: '-1px' }}>✓</span>
            </div>
          </div>
        );
        break;
      case 'dropped':
        statusIcon = (
          <div className="absolute top-2 right-2 z-10 bg-red-500 rounded-full p-1.5 shadow-lg">
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-white text-base font-bold leading-none flex items-center justify-center h-full">×</span>
            </div>
          </div>
        );
        break;
      case 'rewatched':
        statusIcon = (
          <div className="absolute top-2 right-2 z-10 bg-purple-500 rounded-full p-1.5 shadow-lg">
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-white text-sm font-bold leading-none" style={{ marginTop: '-1px' }}>↻</span>
            </div>
          </div>
        );
        break;
    }

    // Если в черном списке - показываем иконку статуса + иконку блокировки
    if (isBlacklisted) {
      return (
        <>
          {statusIcon}
          <div className="absolute top-2 right-2 z-20 bg-gray-800 rounded-full p-1.5 shadow-lg border border-gray-600" style={{ transform: 'translate(8px, -8px)' }}>
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-gray-300 text-sm font-bold">🚫</span>
            </div>
          </div>
        </>
      );
    }

    return statusIcon;
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
          setIsReratingOnly(false);
        }}
        onSave={handleSaveRating}
        title={title}
        releaseDate={movie.release_date || movie.first_air_date || null}
        userRating={userRating}
        defaultRating={pendingStatus === 'dropped' ? 2 : 6}
        showWatchedDate={!isReratingOnly}
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
        isAnime={movieDetails?.isAnime ?? mediaTypeConfig.isAnime}
        collectionName={movieDetails?.collectionName}
        collectionId={movieDetails?.collectionId}
        typeLabel={mediaTypeConfig.label}
        typeBackgroundColor={mediaTypeConfig.backgroundColor}
        currentStatus={status}
        onStatusChange={(newStatus) => {
          handleStatusChange(newStatus);
          setIsRatingInfoOpen(false);
        }}
        onRatingUpdate={(rating) => {
          setUserRating(rating);
          // НЕ увеличиваем watchCount здесь - API сам увеличивает счетчик при isRewatch
          // refreshRatings() можно добавить при необходимости
        }}
        onBlacklistToggle={handleBlacklistToggle}
        isBlacklisted={isBlacklisted}
        isMobile={isMobile}
        tmdbId={movie.id}
        watchCount={watchCount}
        userRating={userRating}
        cast={movieDetails?.cast}
      />

      <div 
        ref={cardRef}
        className="w-full h-full min-w-0 relative"
        >
        <div className="relative">
          <div 
            className="text-white text-xs font-semibold px-2 py-1.5 rounded-t-lg w-full text-center"
            style={{
              backgroundColor: mediaTypeConfig.backgroundColor
            }}
          >
            {mediaTypeConfig.label}
          </div>
          
          <div 
            ref={posterRef}
            className={`relative w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-none overflow-hidden shadow-lg transition-all duration-300 ${
              restoreView || isBlacklisted 
                ? 'opacity-60 grayscale hover:opacity-80 hover:grayscale-0' 
                : isHovered && !showOverlay ? 'shadow-xl' : ''
            } ${showOverlay ? 'cursor-default' : 'cursor-pointer'}`}
            onClick={handlePosterClick}
            onMouseEnter={handlePosterMouseEnter}
            onMouseLeave={handlePosterMouseLeave}
          >
            
            {getStatusIcon()}

            <MoviePosterProxy
              key={movie.id}
              movie={movie}
              priority={priority}
              isBlacklisted={isBlacklisted}
              restoreView={restoreView}
              isHovered={isHovered && !showOverlay}
              showOverlay={showOverlay}
              onClick={handlePosterClick}
              onMouseEnter={handlePosterMouseEnter}
              onMouseLeave={handlePosterMouseLeave}
            />
          </div>

          {showOverlay && (
            <StatusOverlay
              ref={overlayRef}
              status={status}
              isBlacklisted={isBlacklisted}
              restoreView={restoreView}
              onStatusChange={(newStatus) => {
                if (newStatus === 'watched' || newStatus === 'dropped') {
                  setPendingStatus(newStatus);
                  setIsRatingModalOpen(true);
                  setShowOverlay(false);
                } else {
                  handleStatusChange(newStatus);
                }
              }}
              onBlacklistToggle={handleBlacklistToggle}
              onRatingOpen={(isRewatch) => {
                if (isRewatch) {
                  setPendingRewatch(true);
                  setPendingStatus('watched');
                }
                setIsRatingModalOpen(true);
                setShowOverlay(false);
              }}
              onMouseLeave={handleOverlayMouseLeave}
              onClick={handleOverlayClick}
            />
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
          
          {/* Плашка с оценкой пользователя - кликабельная для переоценки */}
          {showRatingBadge && (status === 'watched' || status === 'dropped' || status === 'rewatched') && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsReratingOnly(true);
                setPendingStatus(status as 'watched' | 'dropped' | 'rewatched');
                setIsRatingModalOpen(true);
              }}
              className={`mt-0 px-2 py-1.5 rounded-b-lg text-xs font-semibold w-full text-center cursor-pointer ${userRating ? 'bg-blue-900/80' : 'bg-gray-800/80'} flex items-center hover:bg-blue-800/80 transition-colors`}
            >
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
            </button>
          )}
        </div>
      </div>
    </>
  );
}