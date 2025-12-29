// src/app/components/RatingInfoModal.tsx
'use client';

import { useEffect, useRef } from 'react';

interface RatingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbRating: number;
  tmdbVoteCount: number;
  cineChanceRating: number | null;
  cineChanceVoteCount: number;
  combinedRating: number; // Добавляем пропс для итогового рейтинга
  isMobile: boolean;
}

export default function RatingInfoModal({ 
  isOpen, 
  onClose,
  tmdbRating,
  tmdbVoteCount, 
  cineChanceRating,
  cineChanceVoteCount,
  combinedRating, // Получаем combinedRating
  isMobile 
}: RatingInfoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      {/* Затемненный фон */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        {/* Модальное окно - увеличенное в 2 раза */}
        <div 
          ref={modalRef}
          className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 w-full max-w-[280px]" // 140px * 2 = 280px
        >
          {/* Крестик для закрытия */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
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

          {/* Заголовок */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white text-center">Рейтинг</h3>
            <p className="text-xs text-gray-400 text-center mt-1">Средневзвешенная оценка</p>
          </div>
          
          {/* TMDB рейтинг */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 relative"> {/* Увеличенная иконка */}
                <img 
                  src="/images/TMDB.png" 
                  alt="TMDB" 
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-300">TMDB</div>
                <div className="text-xs text-gray-500">кинопоиск</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold text-white">{tmdbRating.toFixed(1)}</span>
              <span className="text-sm text-gray-500 ml-1">({tmdbVoteCount})</span>
            </div>
          </div>
          
          {/* Разделитель */}
          <div className="h-px bg-gray-700 my-3"></div>
          
          {/* Cine-chance рейтинг */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 relative"> {/* Увеличенная иконка */}
                <img 
                  src="/images/logo_mini_lgt.png" 
                  alt="Cine-chance" 
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-300">Cine-chance</div>
                <div className="text-xs text-gray-500">наша оценка</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold text-white">
                {cineChanceRating !== null ? cineChanceRating.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-gray-500 ml-1">({cineChanceVoteCount})</span>
            </div>
          </div>

          {/* Итоговая оценка */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-300">Итог</div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 relative">
                  <img 
                    src="/images/logo_mini_lgt_pls_tmdb.png" 
                    alt="TMDB + Cine-chance" 
                    className="object-contain w-full h-full"
                  />
                </div>
                <span className="text-2xl font-bold text-white">
                  {combinedRating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}