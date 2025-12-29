// src/app/components/RatingModal.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rating: number, date: string) => void;
  title: string; // Название фильма
  releaseDate: string | null; // Дата релиза фильма (для быстрой кнопки)
  userRating?: number | null; // Текущая оценка пользователя
  defaultRating?: number; // Значение по умолчанию для оценки
}

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

export default function RatingModal({ isOpen, onClose, onSave, title, releaseDate, userRating, defaultRating = 6 }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split('T')[0]);
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);
  const userRatingRef = useRef<number | null>(null);

  // Сохраняем userRating в ref, чтобы не изменять массив зависимостей useEffect
  useEffect(() => {
    userRatingRef.current = userRating ?? null;
  }, [userRating]);

  // Сбрасываем оценку на текущую пользователя или значение по умолчанию и дату на текущую при каждом открытии
  useEffect(() => {
    if (isOpen) {
      setRating(userRatingRef.current ?? defaultRating);
      setWatchedDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, defaultRating]);

  // Логика звездочек
  const handleStarInteraction = (starIndex: number, clientX: number) => {
    const starElement = starRefs.current[starIndex];
    if (!starElement) return;

    const rect = starElement.getBoundingClientRect();
    const localX = clientX - rect.left;
    const isRight = localX >= rect.width / 2;
    const points = (starIndex * 2) + (isRight ? 2 : 1);
    setRating(points);
  };

  const handleStarMouseMove = (starIndex: number, e: React.MouseEvent) => {
    handleStarInteraction(starIndex, e.clientX);
  };

  const handleStarClick = (starIndex: number, e: React.MouseEvent) => {
    handleStarInteraction(starIndex, e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const starElement = element.closest('[data-star-index]');
    if (starElement) {
      const index = parseInt(starElement.getAttribute('data-star-index') || '0');
      handleStarInteraction(index, touch.clientX);
    }
  };

  const handleSave = () => {
    if (rating) {
      onSave(rating, watchedDate);
      onClose();
    }
  };

  const setTodayDate = () => {
    setWatchedDate(new Date().toISOString().split('T')[0]);
  };

  const setReleaseDate = () => {
    if (releaseDate) {
      setWatchedDate(releaseDate.split('T')[0]);
    }
  };

  // SVG Компоненты (внутри файла, чтобы не загромождать глобальное пространство)
  const StarFull = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21L12 17.27z"/>
    </svg>
  );

  const StarHalf = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4V6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>
    </svg>
  );

  const StarEmpty = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4V6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>
    </svg>
  );

  const renderStars = () => {
    const stars = [];
    const val = rating / 2;
    
    for (let i = 0; i < 5; i++) {
      let StarComponent;
      if (val >= i + 1) {
        StarComponent = <div className="text-yellow-400"><StarFull /></div>;
      } else if (val >= i + 0.5) {
        StarComponent = <div className="text-yellow-400"><StarHalf /></div>;
      } else {
        StarComponent = <div className="text-gray-600"><StarEmpty /></div>;
      }

      stars.push(
        <div 
          key={i} 
          ref={(el) => { starRefs.current[i] = el; }} 
          data-star-index={i}
          className="relative inline-block cursor-pointer"
          onMouseMove={(e) => handleStarMouseMove(i, e)}
          onClick={(e) => handleStarClick(i, e)}
        >
          {StarComponent}
        </div>
      );
    }
    return stars;
  };

  // Извлекаем год из releaseDate
  const year = releaseDate ? releaseDate.split('-')[0] : '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-6 w-full max-w-[400px] shadow-2xl">
        
        {/* Название фильма и год */}
        <div className="mb-4">
          <h2 className="text-white text-lg font-semibold leading-tight break-words">
            {title}
            {year && <span className="text-gray-400 font-normal"> ({year})</span>}
          </h2>
        </div>
        
        <label className="block text-gray-400 text-sm mb-4">Ваша оценка</label>
        
        {/* Контейнер для строки */}
        <div className="flex flex-col min-[340px]:flex-row items-center min-[340px]:justify-between gap-2 min-[340px]:gap-0 mb-2">
          
          {/* Контейнер Звезд */}
          <div 
            className="flex items-center justify-center min-[340px]:justify-start flex-shrink-0 w-full min-[340px]:w-auto"
            onTouchMove={handleTouchMove}
          >
            {renderStars()}
          </div>

          {/* Контейнер Цифры */}
          <div className="text-4xl font-bold text-white leading-none flex-shrink-0 w-16 text-center min-[340px]:text-left min-[340px]:ml-4">
            {rating || '—'}
          </div>

        </div>

        <div className="h-8 flex items-center justify-center mb-3">
          <span className="text-white text-base font-medium text-center">
            {rating ? RATING_TEXTS[rating] : 'Оцените фильм'}
          </span>
        </div>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Дата просмотра</label>
          <input
            type="date"
            value={watchedDate}
            onChange={(e) => setWatchedDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Новые кнопки быстрого выбора даты */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={setTodayDate}
            className="flex-1 py-1.5 rounded-md bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
          >
            Сейчас
          </button>
          <button
            onClick={setReleaseDate}
            className="flex-1 py-1.5 rounded-md bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition-colors"
          >
            В дату выхода
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!rating}
            className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}