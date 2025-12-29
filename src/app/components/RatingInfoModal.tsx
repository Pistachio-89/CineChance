// src/app/components/RatingInfoModal.tsx
'use client';

import { useEffect, useRef } from 'react';

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
  isMobile: boolean;
}

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
  isMobile 
}: RatingInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне попапа или на крестик
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
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
      // Блокируем скролл фона
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

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
              {/* Название фильма */}
              <h3 className="text-lg sm:text-xl font-bold text-white text-left pr-10 mb-3 sm:mb-4 break-words">
                {title}
              </h3>
              
              {/* Рейтинги в строку с увеличенными логотипами */}
              <div className="flex items-center justify-between gap-2 sm:gap-6 mb-4 sm:mb-6">
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

          {/* Индикатор скролла (опционально) */}
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