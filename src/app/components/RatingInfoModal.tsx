// src/app/components/RatingInfoModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import ImageWithProxy from './ImageWithProxy';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const RatingModal = dynamic(() => import('./RatingModal'), { ssr: false });
import { 
  getMovieTags, 
  addTagsToMovie, 
  removeTagsFromMovie, 
  searchUserTags,
  getMovieNote,
  updateMovieNote,
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

interface RatingInfoModalProps {
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
  cast?: CastMember[];
}

const STATUS_OPTIONS: { value: MediaStatus; label: string; icon: string; colorClass: string; hoverClass: string }[] = [
  { value: 'want', label: 'Хочу посмотреть', icon: '+', colorClass: 'bg-blue-500', hoverClass: 'hover:bg-blue-500' },
  { value: 'watched', label: 'Просмотрено', icon: '✓', colorClass: 'bg-green-500', hoverClass: 'hover:bg-green-500' },
  { value: 'dropped', label: 'Брошено', icon: '×', colorClass: 'bg-red-500', hoverClass: 'hover:bg-red-500' },
  { value: 'rewatched', label: 'Пересмотрено', icon: '↻', colorClass: 'bg-purple-500', hoverClass: 'hover:bg-purple-500' },
];

const MAX_TAGS = 5;

export default function RatingInfoModal({ 
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
  cast
}: RatingInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  // Состояние оценки для пересмотра
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  
  // Состояние тегов
  const [currentTags, setCurrentTags] = useState<TagData[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<TagData[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Состояние заметки
  const [note, setNote] = useState('');
  const [originalNote, setOriginalNote] = useState('');
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isCastExpanded, setIsCastExpanded] = useState(false);

  // Загрузка тегов и заметки при открытии модального окна
  useEffect(() => {
    if (isOpen && tmdbId && mediaType) {
      loadMovieTags();
      loadMovieNote();
      // Сбрасываем состояние раскрытия при открытии
      setIsNoteExpanded(false);
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
        setNote(result.data);
        setOriginalNote(result.data);
        setLastSaved(null);
        // Если есть заметка — раскрываем секцию
        if (result.data) {
          setIsNoteExpanded(true);
        }
      }
    } catch (error) {
      logger.error('Failed to load movie note', { tmdbId, mediaType, error });
    } finally {
      setIsLoadingNote(false);
    }
  };

  // Проверка, есть ли несохранённые изменения
  const hasUnsavedChanges = note !== originalNote;

  // Сохранение заметки вручную
  const saveNote = async () => {
    if (!tmdbId || !mediaType || !hasUnsavedChanges) return;
    
    setIsSavingNote(true);
    try {
      await updateMovieNote(tmdbId, mediaType, note);
      setOriginalNote(note);
      setLastSaved(new Date());
    } catch (error) {
      logger.error('Failed to save movie note', { tmdbId, mediaType, error });
    } finally {
      setIsSavingNote(false);
    }
  };

  // Поиск тегов для автодополнения
  const handleTagInputChange = async (value: string) => {
    setTagInput(value);
    
    if (value.trim().length > 0) {
      const result = await searchUserTags(value);
      if (result.success && result.data) {
        // Фильтруем теги, которые уже добавлены к фильму
        const existingTagIds = currentTags.map(t => t.id);
        const filteredSuggestions = result.data.filter(t => !existingTagIds.includes(t.id));
        setSuggestions(filteredSuggestions);
        setShowSuggestions(true);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Добавление тега
  const handleAddTag = async (tagName?: string) => {
    const nameToAdd = tagName || tagInput.trim();
    if (!nameToAdd || !tmdbId || !mediaType) return;
    
    if (currentTags.length >= MAX_TAGS) {
      alert(`Максимум ${MAX_TAGS} тегов`);
      return;
    }

    setIsSavingTags(true);
    try {
      const result = await addTagsToMovie(tmdbId, mediaType, [nameToAdd]);
      if (result.success && result.data) {
        setCurrentTags(prev => [...prev, ...result.data!]);
        setTagInput('');
        setSuggestions([]);
        setShowSuggestions(false);
      } else if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      logger.error('Failed to add tag to movie', { tmdbId, mediaType, tagName: nameToAdd, error });
    } finally {
      setIsSavingTags(false);
    }
  };

  // Удаление тега
  const handleRemoveTag = async (tagId: string) => {
    if (!tmdbId || !mediaType) return;
    
    setIsSavingTags(true);
    try {
      const result = await removeTagsFromMovie(tmdbId, mediaType, [tagId]);
      if (result.success) {
        setCurrentTags(prev => prev.filter(t => t.id !== tagId));
      }
    } catch (error) {
      logger.error('Failed to remove tag from movie', { tmdbId, mediaType, tagId, error });
    } finally {
      setIsSavingTags(false);
    }
  };

  // Обработка нажатия Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && tagInput.trim()) {
        // Если есть предложения, добавляем первый вариант
        handleAddTag(suggestions[0].name);
      } else {
        // Создаём новый тег из введённого текста
        handleAddTag();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Закрытие при клике вне попапа или на крестик
  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onClose();
    setIsStatusDropdownOpen(false);
    // Сбрасываем состояние тегов и заметки
    setTagInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setNote('');
    setOriginalNote('');
    setLastSaved(null);
    setIsNoteExpanded(false);
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

  // Закрываем дропдаун статуса при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isStatusDropdownOpen && !target.closest('.status-dropdown-container')) {
        setIsStatusDropdownOpen(false);
      }
    };

    if (isStatusDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isStatusDropdownOpen]);

  // Получаем текущий статус для отображения
  const getCurrentStatusOption = () => {
    if (currentStatus !== null && currentStatus !== undefined) {
      return STATUS_OPTIONS.find(opt => opt.value === currentStatus);
    }
    return null;
  };

  const currentStatusOption = getCurrentStatusOption();

  // Обработчик изменения статуса
  const handleStatusChange = (status: MediaStatus) => {
    if (onStatusChange) {
      onStatusChange(status);
    }
    setIsStatusDropdownOpen(false);
  };

  // Обработчик переключения черного списка
  const handleBlacklistToggle = () => {
    if (onBlacklistToggle) {
      onBlacklistToggle();
    }
    setIsStatusDropdownOpen(false);
  };

  // Обработчик сохранения оценки при пересмотре
  const handleSaveRating = async (rating: number, date: string) => {
    if (!tmdbId || !mediaType || !title) return;

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          title,
          voteAverage: 0,
          userRating: rating,
          watchedDate: date,
          isRewatch: true,
        }),
      });

      if (res.ok) {
        setIsRatingModalOpen(false);
        // Закрываем RatingInfoModal, чтобы при следующем открытии получить обновлённые данные
        onClose();
        // Обновляем статус через коллбэк
        if (onStatusChange) {
          onStatusChange('rewatched');
        }
        // Уведомляем родителя о необходимости обновить рейтинги с новой оценкой
        if (onRatingUpdate) {
          onRatingUpdate(rating);
        }
      } else {
        logger.error('Failed to update rating on rewatch', { tmdbId, mediaType, rating });
      }
    } catch (error) {
      logger.error('Network error while updating rating', { tmdbId, mediaType, error });
    }
  };

  // Получаем цвет фона для текущего статуса
  const getStatusBackgroundColor = () => {
    if (currentStatus === null || currentStatus === undefined) {
      return 'bg-gray-500';
    }
    const option = STATUS_OPTIONS.find(opt => opt.value === currentStatus);
    return option ? option.colorClass : 'bg-gray-500';
  };

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

              {/* Компактный селект статуса */}
              {onStatusChange && (
                <div className="mb-3 status-dropdown-container relative" style={{ maxWidth: '270px' }}>
                  <label className="text-xs text-gray-400 block mb-1">Статус</label>
                  
                  {/* Текущий выбранный статус */}
                  <button
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${currentStatusOption ? currentStatusOption.colorClass : 'bg-gray-500'} text-white`}
                  >
                    <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">
                      {currentStatusOption ? currentStatusOption.icon : '—'}
                    </span>
                    <span className="truncate">
                      {currentStatusOption ? currentStatusOption.label : 'Не просмотрено'}
                    </span>
                    {/* Стрелка */}
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  
                  {/* Счётчик повторов - только для статуса Пересмотрено */}
                  {currentStatus === 'rewatched' && watchCount !== undefined && watchCount >= 1 && (
                    <Link
                      href={`/movie-history?tmdbId=${tmdbId}&mediaType=${mediaType}`}
                      className="mt-1 text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4"></path>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                        <path d="M7 23l-4-4 4-4"></path>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                      </svg>
                      <span>{watchCount} {formatRepeatWord(watchCount)}</span>
                    </Link>
                  )}
                  
                  {/* Выпадающий список */}
                  {isStatusDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl overflow-hidden" style={{ maxWidth: '270px' }}>
                      <div className="py-1">
                        {/* Статусы */}
                        {STATUS_OPTIONS.map((option) => {
                          // Для Пересмотрено открываем модальное окно оценки
                          if (option.value === 'rewatched') {
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setIsRatingModalOpen(true);
                                  setIsStatusDropdownOpen(false);
                                }}
                                className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${
                                  currentStatus === option.value 
                                    ? `${option.colorClass} text-white` 
                                    : 'bg-white/5 text-white hover:bg-white/10'
                                }`}
                              >
                                <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">
                                  {option.icon}
                                </span>
                                <span className="truncate">{option.label}</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              key={option.value}
                              onClick={() => handleStatusChange(option.value)}
                              className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${
                                currentStatus === option.value 
                                  ? `${option.colorClass} text-white` 
                                  : 'bg-white/5 text-white hover:bg-white/10'
                              }`}
                            >
                              <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">
                                {option.icon}
                              </span>
                              <span className="truncate">{option.label}</span>
                            </button>
                          );
                        })}
                        
                        {/* Разделитель */}
                        <div className="h-px bg-gray-700 my-1 mx-2"></div>
                        
                        {/* В черный список */}
                        <button
                          onClick={handleBlacklistToggle}
                          className="w-full py-1 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer bg-white/5 text-gray-300 hover:bg-orange-900/50 hover:text-orange-300"
                        >
                          <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">🚫</span>
                          <span className="truncate">
                            {isBlacklisted ? 'Разблокировать' : 'В черный список'}
                          </span>
                        </button>
                        
                        {/* Убрать из списков */}
                        {currentStatus && (
                          <button
                            onClick={() => handleStatusChange(null)}
                            className="w-full py-1 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer bg-white/5 text-gray-300 hover:bg-white/10 mt-0.5"
                          >
                            <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">×</span>
                            <span className="truncate">Убрать из списков</span>
                          </button>
                        )}
                      </div>
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

              {/* Блок тегов - только если фильм в списке */}
              {currentStatus && (
                <div className="space-y-1">
                  <span className="text-xs sm:text-sm text-gray-400">
                    Теги <span className="text-gray-600">({currentTags.length}/{MAX_TAGS})</span>
                  </span>
                  
                  {/* Поле ввода тегов */}
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => handleTagInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => {
                        if (tagInput.trim() && suggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      placeholder={currentTags.length >= MAX_TAGS ? 'Лимит reached' : 'Введите тег...'}
                      disabled={isSavingTags || currentTags.length >= MAX_TAGS}
                      className="w-full py-1.5 px-2 rounded-lg bg-[#1a1f2e] border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                    
                    {/* Индикатор загрузки */}
                    {isSavingTags && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    
                    {/* Выпадающий список подсказок */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                        {suggestions.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => handleAddTag(tag.name)}
                            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer bg-white/5 text-white hover:bg-blue-500/20"
                          >
                            <span className="truncate flex-1">{tag.name}</span>
                            <span className="text-gray-500 text-[10px] ml-2">{tag.usageCount} раз</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Отображение выбранных тегов */}
                  {currentTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30"
                        >
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            disabled={isSavingTags}
                            className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-500/40 transition-colors disabled:opacity-50"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Приватная заметка */}
              {currentStatus && (
                <div className="mt-4 pt-3 border-t border-gray-800">
                  {/* Кнопка раскрытия */}
                  <button
                    onClick={() => setIsNoteExpanded(!isNoteExpanded)}
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
                        className={`transition-transform duration-200 ${isNoteExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span>Личная заметка</span>
                    </div>
                    {/* Дата сохранения и кнопка - только когда раскрыто */}
                    {isNoteExpanded && (
                      <div className="flex items-center gap-2">
                        {lastSaved && (
                          <span className="text-[10px] text-gray-600">
                            {lastSaved.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <div
                          onClick={saveNote}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                          className={`
                            px-3 py-0.5 rounded-lg text-xs font-medium transition-all duration-200 flex-shrink-0 cursor-pointer
                            ${hasUnsavedChanges && !isSavingNote
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'}
                            ${isSavingNote ? 'opacity-50' : ''}
                          `}
                        >
                          {isSavingNote ? 'Сохранение...' : 'Сохранить'}
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Раскрывающееся поле */}
                  {isNoteExpanded && (
                    <div className="mt-2 ml-4">
                      <div className="relative">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value.slice(0, 100))}
                          maxLength={100}
                          placeholder="Введите заметку..."
                          disabled={isLoadingNote}
                          className="w-full min-h-[80px] py-2 px-3 pr-14 rounded-lg bg-[#1a1f2e] border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-y"
                        />
                        <span className="absolute bottom-2 right-3 text-[10px] text-gray-500">
                          {note.length}/100
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Остальная информация в две колонки на десктопе */}
              <div className="grid grid-cols-1 sm:grid-cols-[270px_266px_80px] gap-3 sm:gap-4">
                {/* Жанр */}
                {genres && genres.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-gray-400">Жанр</span>
                    <div className="flex flex-wrap gap-1">
                      {genres.filter(Boolean).map((genre, index) => (
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
                        <Link
                          key={actor.id}
                          href={`/person/${actor.id}`}
                          className="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5 text-white hover:bg-blue-500/20 transition-colors group"
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
            </div>
          </div>

          {/* Модальное окно оценки для пересмотра */}
          <RatingModal 
            isOpen={isRatingModalOpen}
            onClose={() => setIsRatingModalOpen(false)}
            onSave={handleSaveRating}
            title={title}
            releaseDate={releaseDate || null}
            defaultRating={6}
          />

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
