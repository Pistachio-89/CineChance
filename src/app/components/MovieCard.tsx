// src/app/components/MovieCard.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Movie } from '@/lib/tmdb';
import { getMovieStatus, setMovieStatus, MovieStatus } from '@/lib/movieStatus';

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [status, setStatus] = useState<MovieStatus>(null);
  const [isMobile, setIsMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const imageUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : '/placeholder-poster.svg';

  // Инициализируем статус при монтировании
  useEffect(() => {
    setStatus(getMovieStatus(movie.id));
    
    // Проверяем, мобильное ли устройство
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [movie.id]);

  // Обработчик клика вне карточки
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(event.target as Node) &&
        cardRef.current &&
        !cardRef.current.contains(event.target as Node) &&
        showOverlay
      ) {
        setShowOverlay(false);
      }
    };

    if (showOverlay) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOverlay]);

  // Функция для изменения статуса
  const handleStatusChange = (newStatus: MovieStatus) => {
    setStatus(newStatus);
    setMovieStatus(movie.id, newStatus);
    setShowOverlay(false);
  };

  // Функция для получения иконки статуса
  const getStatusIcon = () => {
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

  // Обработчик клика/тапа на карточку
  const handleCardClick = () => {
    if (isMobile) {
      // На мобильных показываем/скрываем оверлей по клику
      setShowOverlay(!showOverlay);
    }
  };

  // Обработчик наведения на десктопе
  const handleMouseEnter = () => {
    if (!isMobile) {
      setShowOverlay(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setShowOverlay(false);
    }
  };

  return (
    <div 
      ref={cardRef}
      className="group w-full h-full min-w-0 relative"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Контейнер постера с плавной анимацией */}
      <div className={`relative w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 ${
        showOverlay && !isMobile ? 'cursor-default' : 'cursor-pointer'
      }`}>
        {/* Иконка статуса (всегда видна) */}
        {getStatusIcon()}

        <Image
          src={imageUrl}
          alt={movie.title || 'Фильм без названия'}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 48vw,
                 (max-width: 768px) 31vw,
                 (max-width: 1024px) 23vw,
                 (max-width: 1280px) 19vw,
                 15vw"
          loading="lazy"
        />
        
        {/* Оверлей с кнопками выбора статуса */}
        {showOverlay && (
          <div 
            ref={overlayRef}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 sm:p-3 z-20"
          >
            <div className="w-full max-w-[140px] sm:max-w-[150px] space-y-1">
              <button
                onClick={() => handleStatusChange('want')}
                className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${
                  status === 'want' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-base font-bold min-w-[16px] flex justify-center mr-1.5">+</span>
                <span className="truncate">Хочу посмотреть</span>
              </button>
              
              <button
                onClick={() => handleStatusChange('watched')}
                className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${
                  status === 'watched' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">✓</span>
                <span className="truncate">Просмотрено</span>
              </button>
              
              <button
                onClick={() => handleStatusChange('dropped')}
                className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-start text-left cursor-pointer ${
                  status === 'dropped' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-sm font-bold min-w-[16px] flex justify-center mr-1.5">×</span>
                <span className="truncate">Брошено</span>
              </button>

              {status && (
                <button
                  onClick={() => handleStatusChange(null)}
                  className="w-full py-1 px-2 rounded-lg text-[10px] sm:text-xs font-medium bg-gray-800/50 text-gray-300 hover:bg-gray-800/70 mt-1 flex items-center justify-center cursor-pointer"
                >
                  Убрать из списков
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Оверлей при наведении (только для десктопа, если не показываются кнопки) */}
        {!showOverlay && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 sm:p-3">
            <h3 className="text-white font-bold text-xs sm:text-sm mb-1.5 line-clamp-3">
              {movie.title}
            </h3>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center bg-black/40 px-1.5 py-0.5 rounded">
                <span className="text-yellow-400 mr-1 text-xs">★</span>
                <span className="text-white font-medium">
                  {movie.vote_average?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="bg-black/40 px-1.5 py-0.5 rounded">
                <span className="text-gray-300">
                  {movie.release_date?.split('-')[0] || '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Информация под постером */}
      <div className="mt-2 px-0.5">
        <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-1 leading-tight">
          {movie.title}
        </h3>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center space-x-1">
            <div className="flex items-center bg-gray-800/50 px-1.5 py-0.5 rounded text-xs">
              <span className="text-yellow-400 mr-1">★</span>
              <span className="text-gray-200 font-medium">
                {movie.vote_average?.toFixed(1) || '0.0'}
              </span>
            </div>
            <div className="text-xs text-gray-400 hidden sm:inline">
              {movie.release_date?.split('-')[0] || '—'}
            </div>
          </div>
          <div className="text-xs text-gray-400 sm:hidden">
            {movie.release_date?.split('-')[0] || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}