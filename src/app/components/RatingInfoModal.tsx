// src/app/components/RatingInfoModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type MediaStatus = 'want' | 'watched' | 'dropped' | null;

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
  onBlacklistToggle?: () => void;
  isMobile: boolean;
}

const STATUS_OPTIONS: { value: MediaStatus; label: string; icon: string; colorClass: string; hoverClass: string }[] = [
  { value: 'want', label: 'Хочу посмотреть', icon: '+', colorClass: 'bg-blue-500', hoverClass: 'hover:bg-blue-500' },
  { value: 'watched', label: 'Просмотрено', icon: '✓', colorClass: 'bg-green-500', hoverClass: 'hover:bg-green-500' },
  { value: 'dropped', label: 'Брошено', icon: '×', colorClass: 'bg-red-500', hoverClass: 'hover:bg-red-500' },
];

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
  onBlacklistToggle,
  isMobile 
}: RatingInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Закрытие при клике вне попапа или на крестик
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    setIsStatusDropdownOpen(false);
  };

  // Обработчик клика на затемненный фон
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // Закрытие при нажатии Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

  // Закрываем дропдаун при клике вне его
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
            height: isMobile ? '85vh' : '450px',
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
            className="h-full overflow-y-auto"
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
                  <span className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-md ${mediaType === 'movie' ? 'bg-green-500' : 'bg-blue-500'}`}>
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
                  
                  {/* Выпадающий список */}
                  {isStatusDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl overflow-hidden" style={{ maxWidth: '270px' }}>
                      <div className="py-1">
                        {/* Статусы */}
                        {STATUS_OPTIONS.map((option) => (
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
                        ))}
                        
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

              {/* Двухколоночная сетка с адаптивным поведением */}
              <div className="space-y-3 sm:space-y-4">
                {/* Описание - занимает всю ширину */}
                {overview && (
                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm text-gray-400">Описание</span>
                    <p className="text-xs sm:text-sm text-white leading-relaxed">
                      {overview}
                    </p>
                  </div>
                )}

                {/* Франшиза / Серия фильмов */}
                {collectionName && collectionId && (
                  <div className="space-y-1">
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
              </div>
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
