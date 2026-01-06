// src/app/recommendations/RecommendationInfoModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  cast?: CastMember[];
  crew?: CrewMember[];
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

interface RecommendationInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: MovieData | null;
  isAnime: boolean;
}

export default function RecommendationInfoModal({
  isOpen,
  onClose,
  movie,
  isAnime,
}: RecommendationInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCastExpanded, setIsCastExpanded] = useState(false);
  const [isCrewExpanded, setIsCrewExpanded] = useState(false);

  // Получаем режиссёров
  const directors = movie?.crew?.filter(person => person.department === 'Directing' && person.job === 'Director') || [];
  
  // Получаем топ-5 актёров
  const topCast = movie?.cast?.slice(0, 5) || [];

  // Закрытие при клике вне попапа или на крестик
  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onClose();
  };

  // Обработчик клика на затемненный фон
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
  };

  // Закрытие при нажатии Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !movie) return null;

  // Форматируем дату
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Форматируем длительность
  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}ч ${mins}м`;
    }
    return `${mins}м`;
  };

  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;

  return (
    <>
      {/* Затемненный фон */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-4"
        onClick={handleOverlayClick}
      >
        {/* Модальное окно */}
        <div 
          ref={modalRef}
          className="relative bg-[#0a0e17] border border-blue-500/50 rounded-[20px] shadow-2xl overflow-hidden"
          style={{ 
            width: '700px',
            height: '80vh',
            maxWidth: '95vw',
            maxHeight: '90vh'
          }}
        >
          {/* Крестик для закрытия */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10 bg-[#0a0e17] rounded-full border border-blue-500/30"
            aria-label="Закрыть"
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* Контент с вертикальным скроллом */}
          <div 
            ref={contentRef}
            className="modal-scrollbar h-full overflow-y-auto"
          >
            <div className="p-4 sm:p-5">
              {/* Заголовок с постером */}
              <div className="flex gap-4 mb-4">
                {/* Постер */}
                <div className="flex-shrink-0 w-24 sm:w-32">
                  {movie.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                      alt={title}
                      width={128}
                      height={192}
                      className="w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center">
                      <span className="text-gray-600 text-xs">Нет постера</span>
                    </div>
                  )}
                </div>

                {/* Информация справа от постера */}
                <div className="flex-1 min-w-0">
                  {/* Название фильма */}
                  <h2 className="text-lg sm:text-xl font-bold text-white text-left mb-2 break-words">
                    {title}
                  </h2>

                  {/* Мета-информация */}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400 mb-3">
                    {/* Год */}
                    {releaseDate && (
                      <span>{releaseDate.split('-')[0]}</span>
                    )}
                    
                    {/* Разделитель */}
                    {releaseDate && movie.runtime > 0 && (
                      <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span>
                    )}

                    {/* Длительность */}
                    {movie.runtime > 0 && (
                      <span>{formatDuration(movie.runtime)}</span>
                    )}

                    {/* Разделитель */}
                    {(releaseDate && movie.runtime > 0) && movie.genres && movie.genres.length > 0 && (
                      <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span>
                    )}

                    {/* Жанры */}
                    {movie.genres && movie.genres.length > 0 && (
                      <span className="truncate">
                        {movie.genres.map(g => g.name).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Тип контента */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-md ${isAnime ? 'bg-[#9C40FE]' : (movie.media_type === 'movie' ? 'bg-green-500' : 'bg-blue-500')} text-white`}>
                      {isAnime ? 'Аниме' : (movie.media_type === 'movie' ? 'Фильм' : 'Сериал')}
                    </span>

                    {/* Страны производства */}
                    {movie.production_countries && movie.production_countries.length > 0 && (
                      <span className="text-xs sm:text-sm text-gray-400 py-0.5">
                        ({movie.production_countries.map(c => c.name).join(', ')})
                      </span>
                    )}
                  </div>

                  {/* Рейтинг */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 relative">
                      <Image 
                        src="/images/logo_mini_lgt_pls_tmdb.png" 
                        alt="TMDB Logo" 
                        fill 
                        className="object-contain" 
                      />
                    </div>
                    <span className="text-lg font-bold text-white">
                      {movie.vote_average.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({movie.vote_count.toLocaleString()} голосов)
                    </span>
                  </div>
                </div>
              </div>

              {/* Описание */}
              {movie.overview && (
                <div className="space-y-1 mb-4">
                  <span className="text-xs sm:text-sm text-gray-400">Описание</span>
                  <p className="text-xs sm:text-sm text-white leading-relaxed">
                    {movie.overview}
                  </p>
                </div>
              )}

              {/* Режиссёры */}
              {directors.length > 0 && (
                <div className="space-y-1 mb-3">
                  <span className="text-xs sm:text-sm text-gray-400">Режиссёр</span>
                  <div className="flex flex-wrap gap-2">
                    {directors.map((director) => (
                      <Link
                        key={director.id}
                        href={`/person/${director.id}`}
                        className="text-xs sm:text-sm text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
                      >
                        {director.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Актеры */}
              {topCast.length > 0 && (
                <div className="pt-3 border-t border-gray-800">
                  <button
                    onClick={() => setIsCastExpanded(!isCastExpanded)}
                    className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${isCastExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span>В ролях</span>
                    </div>
                    <span className="text-[10px] text-gray-600">{topCast.length}</span>
                  </button>

                  {isCastExpanded && (
                    <div className="mt-2 ml-4 space-y-1">
                      {topCast.map((actor) => (
                        <Link
                          key={actor.id}
                          href={`/person/${actor.id}`}
                          className="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5 text-white hover:bg-blue-500/20 transition-colors group"
                        >
                          {/* Фото актера */}
                          {actor.profilePath ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${actor.profilePath}`}
                              alt={actor.name}
                              className="w-6 h-8 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-8 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white group-hover:text-blue-300 transition-colors truncate block">
                              {actor.name}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate block">
                              {actor.character}
                            </span>
                          </div>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0 ml-1">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Дата выхода */}
              {releaseDate && (
                <div className="pt-3 border-t border-gray-800">
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-gray-400">Дата выхода</span>
                    <span className="text-xs sm:text-sm text-white block">
                      {formatDate(releaseDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Индикатор скролла */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <div className="w-20 h-1 bg-blue-500/30 rounded-full"></div>
          </div>
        </div>
      </div>
    </>
  );
}
