// src/app/recommendations/RecommendationInfoModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import ImageWithProxy from '@/app/components/ImageWithProxy';
import Link from 'next/link';
import { 
  getMovieTags, 
  getMovieNote,
  TagData 
} from '@/app/actions/tagsActions';
import { logger } from '@/lib/logger';

type MediaStatus = 'want' | 'watched' | 'dropped' | 'rewatched' | null;

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

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
  seasonNumber?: string | null;
  collectionName?: string | null;
  collectionId?: number | null;
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
  title: string;
  tmdbRating: number;
  tmdbVoteCount: number;
  cineChanceRating: number | null;
  cineChanceVoteCount: number;
  combinedRating: number;
  overview?: string;
  releaseDate?: string;
  genres?: string[];
  runtime?: number;
  adult?: boolean;
  productionCountries?: string[];
  seasonNumber?: string | null;
  mediaType?: string;
  isAnime?: boolean;
  collectionName?: string | null;
  collectionId?: number | null;
  currentStatus?: MediaStatus;
  isBlacklisted?: boolean;
  onStatusChange?: (status: MediaStatus) => void;
  onRatingUpdate?: (rating: number) => void;
  onBlacklistToggle?: () => void;
  isMobile: boolean;
  tmdbId?: number;
  userRating?: number | null;
  watchCount?: number;
  movie?: MovieData | null;
}

const STATUS_OPTIONS: { value: MediaStatus; label: string; icon: string; colorClass: string; hoverClass: string }[] = [
  { value: 'want', label: 'Хочу посмотреть', icon: '+', colorClass: 'bg-blue-500', hoverClass: 'hover:bg-blue-500' },
  { value: 'watched', label: 'Просмотрено', icon: '✓', colorClass: 'bg-green-500', hoverClass: 'hover:bg-green-500' },
  { value: 'dropped', label: 'Брошено', icon: '×', colorClass: 'bg-red-500', hoverClass: 'hover:bg-red-500' },
  { value: 'rewatched', label: 'Пересмотрено', icon: '↻', colorClass: 'bg-purple-500', hoverClass: 'hover:bg-purple-500' },
];

const MAX_TAGS = 5;

export default function RecommendationInfoModal({ 
  isOpen, 
  onClose,
  title,
  tmdbRating,
  tmdbVoteCount, 
  cineChanceRating,
  cineChanceVoteCount,
  combinedRating,
  overview,
  releaseDate,
  genres,
  runtime,
  adult,
  productionCountries,
  seasonNumber,
  mediaType,
  isAnime,
  collectionName,
  collectionId,
  currentStatus,
  isBlacklisted,
  onStatusChange,
  onRatingUpdate,
  onBlacklistToggle,
  isMobile,
  tmdbId,
  userRating,
  watchCount,
}: RecommendationInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Состояние для cast (загружаем через /api/movie-details)
  const [cast, setCast] = useState<CastMember[]>([]);
  const [isLoadingCast, setIsLoadingCast] = useState(false);

  // Загружаем cast при открытии модального окна
  useEffect(() => {
    if (isOpen && tmdbId && mediaType) {
      const loadCast = async () => {
        setIsLoadingCast(true);
        try {
          const res = await fetch(`/api/movie-details?tmdbId=${tmdbId}&mediaType=${mediaType}`);
          if (res.ok) {
            const data = await res.json();
            if (data.cast && data.cast.length > 0) {
              setCast(data.cast);
            }
          }
        } catch (error) {
          logger.error('Failed to load cast information', { tmdbId, mediaType, error });
        } finally {
          setIsLoadingCast(false);
        }
      };
      loadCast();
    }
  }, [isOpen, tmdbId, mediaType]);
  
  // Состояние тегов
  const [currentTags, setCurrentTags] = useState<TagData[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // Состояние заметки
  const [note, setNote] = useState('');
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [isCastExpanded, setIsCastExpanded] = useState(false);

  // Загрузка тегов и заметки при открытии модального окна
  useEffect(() => {
    if (isOpen && tmdbId && mediaType) {
      loadMovieTags();
      loadMovieNote();
    }
  }, [isOpen, tmdbId, mediaType]);

  // Загрузка тегов фильма
  const loadMovieTags = async () => {
    if (!tmdbId || !mediaType) return;
    
    setIsLoadingTags(true);
    try {
      const result = await getMovieTags(tmdbId, mediaType);
      if (result.success && result.data) {
        setCurrentTags(result.data);
      }
    } catch (error) {
      logger.error('Failed to load movie tags', { tmdbId, mediaType, error });
    } finally {
      setIsLoadingTags(false);
    }
  };

  // Загрузка заметки фильма
  const loadMovieNote = async () => {
    if (!tmdbId || !mediaType) return;
    
    setIsLoadingNote(true);
    try {
      const result = await getMovieNote(tmdbId, mediaType);
      if (result.success && result.data !== undefined) {
        setNote(result.data || '');
      }
    } catch (error) {
      logger.error('Failed to load movie note', { tmdbId, mediaType, error });
    } finally {
      setIsLoadingNote(false);
    }
  };

  // Закрытие при клике вне попапа или на крестик
  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onClose();
    // Сбрасываем состояние тегов и заметки
    setNote('');
    setIsCastExpanded(false);
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

  // Получаем текущий статус для отображения
  const getCurrentStatusOption = () => {
    if (currentStatus !== null && currentStatus !== undefined) {
      return STATUS_OPTIONS.find(opt => opt.value === currentStatus);
    }
    return null;
  };

  const currentStatusOption = getCurrentStatusOption();

  if (!isOpen) return null;

  // Форматируем дату
  const formatDate = (dateStr?: string) => {
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

  // Склоняем слово "повтор" в зависимости от числа
  const formatRepeatWord = (count: number) => {
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = ['повтор', 'повтора', 'повторов'];
    return titles[count % 100 > 4 && count % 100 < 20 ? 2 : cases[count % 10 < 5 ? count % 10 : 5]];
  };

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
            width: isMobile ? '95vw' : '700px',
            height: isMobile ? '85vh' : '80vh',
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
              {/* Название фильма с типом и страной */}
              <div className="flex flex-wrap items-center gap-2 text-lg sm:text-xl font-bold text-white text-left pr-10 mb-3 sm:mb-4 break-words">
                <span>{title}</span>
                
                {/* Страна производства */}
                {productionCountries && productionCountries.length > 0 && (
                  <span className="text-sm sm:text-base font-normal text-gray-400">
                    ({productionCountries.join(', ')})
                  </span>
                )}
                
                {/* Тип фильма */}
                {mediaType && (
                  <span className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-md ${isAnime ? 'bg-[#9C40FE]' : (mediaType === 'movie' ? 'bg-green-500' : 'bg-blue-500')}`}>
                    {isAnime ? 'Аниме' : (mediaType === 'movie' ? 'Фильм' : 'Сериал')}
                    {seasonNumber && ` • ${seasonNumber}`}
                  </span>
                )}
              </div>
              
              {/* Рейтинги в строку с увеличенными логотипами */}
              <div className="flex items-center justify-between gap-2 sm:gap-6 mb-3 sm:mb-4">
                {/* Общий рейтинг */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} relative flex-shrink-0`}>
                    <img 
                      src="/images/logo_mini_lgt_pls_tmdb.png" 
                      alt="Combined" 
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white`}>
                    {combinedRating.toFixed(1)}
                  </span>
                </div>
                
                {/* Cine-chance рейтинг */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} relative flex-shrink-0`}>
                    <img 
                      src="/images/logo_mini_lgt.png" 
                      alt="Cine-chance" 
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white`}>
                    {cineChanceRating !== null ? cineChanceRating.toFixed(1) : '—'}
                  </span>
                </div>
                
                {/* TMDB рейтинг */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className={`${isMobile ? 'w-9 h-9' : 'w-10 h-10'} relative flex-shrink-0`}>
                    <img 
                      src="/images/TMDB.png" 
                      alt="TMDB" 
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-white`}>
                    {tmdbRating.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Компактный отображение статуса (только чтение) */}
              {currentStatusOption && (
                <div className="mb-3" style={{ maxWidth: '270px' }}>
                  <label className="text-xs text-gray-400 block mb-1">Статус</label>
                  
                  {/* Текущий статус - статическое отображение */}
                  <div className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium flex items-center ${currentStatusOption.colorClass} text-white`}>
                    <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">
                      {currentStatusOption.icon}
                    </span>
                    <span className="truncate">
                      {currentStatusOption.label}
                    </span>
                  </div>
                  
                  {/* Счётчик повторов - только для статуса Пересмотрено */}
                  {currentStatus === 'rewatched' && watchCount !== undefined && watchCount >= 1 && (
                    <div className="mt-1 text-xs text-purple-400 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4"></path>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                        <path d="M7 23l-4-4 4-4"></path>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                      </svg>
                      <span>{watchCount} {formatRepeatWord(watchCount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Описание - занимает всю ширину */}
              {overview && (
                <div className="space-y-1 mb-4">
                  <span className="text-xs sm:text-sm text-gray-400">Описание</span>
                  <p className="text-xs sm:text-sm text-white leading-relaxed">
                    {overview}
                  </p>
                </div>
              )}

              {/* Франшиза / Серия фильмов */}
              {collectionName && collectionId && (
                <div className="space-y-1 mb-4">
                  <span className="text-xs sm:text-sm text-gray-400">Серия</span>
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/collection/${collectionId}`}
                      className="text-xs sm:text-sm text-indigo-400 font-medium hover:text-indigo-300 transition-colors flex items-center gap-1"
                    >
                      📚 {collectionName}
                      <span className="text-gray-500">→</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Блок тегов - только если есть теги */}
              {currentTags.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs sm:text-sm text-gray-400">Теги</span>
                  
                  {/* Отображение тегов */}
                  <div className="flex flex-wrap gap-1">
                    {currentTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Приватная заметка - только если есть заметка */}
              {note && (
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <span className="text-xs sm:text-sm text-gray-400 mb-2 block">Личная заметка</span>
                  <div className="bg-[#1a1f2e] rounded-lg p-3 text-white text-xs leading-relaxed whitespace-pre-wrap">
                    {note}
                  </div>
                </div>
              )}

              {/* Остальная информация в две колонки на десктопе */}
              <div className="grid grid-cols-1 sm:grid-cols-[270px_266px_80px] gap-3 sm:gap-4">
                {/* Жанр */}
                {genres && genres.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-gray-400">Жанр</span>
                    <div className="flex flex-wrap gap-1">
                      {genres.map((genre, index) => (
                        <span 
                          key={index}
                          className="text-xs sm:text-sm text-white bg-blue-500/10 px-2 py-1 rounded-md"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Дата выхода */}
                {releaseDate && (
                  <div className="space-y-1 ">
                    <span className="text-xs sm:text-sm text-gray-400">Дата выхода</span>
                    <span className="text-xs sm:text-sm text-white block">
                      {formatDate(releaseDate)}
                    </span>
                  </div>
                )}  

                {/* Время */}
                {runtime && (
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-gray-400">Время</span>
                    <span className="text-xs sm:text-sm text-white block">
                      {formatDuration(runtime)}
                    </span>
                  </div>
                )}
              </div>

              {/* Блок с актерами */}
              {cast && cast.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-800">
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
                    <span className="text-[10px] text-gray-600">{cast.length}</span>
                  </button>

                  {isCastExpanded && (
                    <div className="mt-2 ml-4 space-y-1">
                      {cast.map((actor) => (
                        <div
                          key={actor.id}
                          className="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5 text-white"
                        >
                          {/* Фото актера */}
                          {actor.profilePath ? (
                            <div className="w-6 h-8 relative flex-shrink-0">
                              <ImageWithProxy
                                src={`https://image.tmdb.org/t/p/w92${actor.profilePath}`}
                                alt={actor.name}
                                fill
                                className="object-cover rounded"
                                sizes="24px"
                              />
                            </div>
                          ) : (
                            <div className="w-6 h-8 bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white truncate block">
                              {actor.name}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate block">
                              {actor.character}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>



          {/* Индикатор скролла */}
          {!isMobile && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <div className="w-20 h-1 bg-blue-500/30 rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
