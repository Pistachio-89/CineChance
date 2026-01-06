// src/app/recommendations/RecommendationCard.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import RecommendationInfoModal from './RecommendationInfoModal';

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
  cast?: { id: number; name: string; character: string; profilePath: string | null }[];
  crew?: { id: number; name: string; job: string; department: string; profilePath: string | null }[];
}

type MediaStatus = 'want' | 'watched' | 'dropped' | 'rewatched' | null;

interface RecommendationCardProps {
  movie: MovieData;
  userStatus: MediaStatus;
  isAnime: boolean;
  actionLoading: boolean;
  onSkip: () => void;
  onAccept: () => void;
}

// Получение года из даты
function getYear(movieData: MovieData): string {
  const date = movieData.release_date || movieData.first_air_date;
  return date ? date.split('-')[0] : '—';
}

// Иконка статуса - отображаем для всех статусов
function getStatusIcon(status: MediaStatus) {
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
    case 'rewatched':
      return (
        <div className="absolute top-2 right-2 z-10 bg-purple-500 rounded-full p-1.5 shadow-lg">
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="text-white text-sm font-bold leading-none" style={{ marginTop: '-1px' }}>↻</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function RecommendationCard({
  movie,
  userStatus,
  isAnime,
  actionLoading,
  onSkip,
  onAccept,
}: RecommendationCardProps) {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Определяем отображаемый тип контента
  const displayType = isAnime ? 'anime' : (movie.media_type === 'movie' ? 'movie' : 'tv');
  const typeLabel = isAnime ? 'Аниме' : (movie.media_type === 'movie' ? 'Фильм' : 'Сериал');
  const typeColor = isAnime ? 'bg-[#9C40FE]' : (movie.media_type === 'movie' ? 'bg-green-500' : 'bg-blue-500');

  return (
    <>
      <div className="max-w-xs mx-auto animate-in fade-in duration-300">
        {/* Тип фильма над постером */}
        <div className={`${typeColor} text-white text-sm font-semibold px-2 py-1.5 rounded-t-lg w-full text-center`}>
          {typeLabel}
        </div>
        
        {/* Постер - кликабельный */}
        <button
          onClick={() => setIsInfoModalOpen(true)}
          className={`relative w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-b-lg overflow-hidden shadow-lg mb-3 cursor-pointer hover:opacity-95 transition-opacity`}
        >
          {movie.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title || movie.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <span className="text-gray-600 text-sm">Нет постера</span>
            </div>
          )}
          
          {/* Иконка статуса в правом верхнем углу */}
          {getStatusIcon(userStatus)}
        </button>

        {/* Информация под постером - кликабельный блок */}
        <button
          onClick={() => setIsInfoModalOpen(true)}
          className="block w-full mt-1 mb-4 text-left hover:bg-white/5 rounded-lg -mx-2 px-2 py-1 transition-colors"
        >
          {/* Заголовок с названием фильма и годом в одной строке */}
          <div className={`flex items-center justify-between gap-2 text-white`}>
            <h3 className={`text-sm sm:text-base font-semibold flex-1 min-w-0 overflow-hidden`} style={{ 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>
              {movie.title || movie.name}
            </h3>
            <div className="text-xs text-gray-400 flex-shrink-0">
              {getYear(movie)}
            </div>
          </div>
          
          {/* Блок с "Подробнее" и рейтингом */}
          <div className="flex items-center justify-between mt-1 w-full">
            {/* Кнопка "Подробнее" слева */}
            <div className="text-sm py-1 text-gray-400">
              Подробнее
            </div>
            
            {/* Рейтинг справа */}
            <div className="flex items-center bg-gray-800/50 rounded text-sm relative">
              <div className="w-5 h-5 relative mx-1">
                  <Image 
                      src="/images/logo_mini_lgt_pls_tmdb.png" 
                      alt="TMDB Logo" 
                      fill 
                      className="object-contain" 
                  />
              </div>
              <span className="text-gray-200 font-medium pr-1">
                {movie.vote_average.toFixed(1)}
              </span>
            </div>
          </div>
        </button>

        {/* Кнопки действий */}
        <div className="flex gap-2">
          {/* Не хочу! Следующий */}
          <button
            onClick={onSkip}
            disabled={actionLoading}
            className="flex-1 py-2.5 px-3 bg-red-600/20 border border-red-500/30 text-red-400 text-sm rounded-lg font-medium hover:bg-red-600/30 transition disabled:opacity-50 cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold leading-tight">Не хочу!</span>
              <span className="text-xs font-normal mt-0.5 opacity-90">Следующий</span>
            </div>
          </button>

          {/* Отлично! Посмотрю */}
          <button
            onClick={onAccept}
            disabled={actionLoading}
            className="flex-1 py-2.5 px-3 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-500 transition disabled:opacity-50 cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold leading-tight">Отлично!</span>
              <span className="text-xs font-normal mt-0.5 opacity-90">Посмотрю</span>
            </div>
          </button>
        </div>
      </div>

      {/* Модальное окно с подробной информацией */}
      <RecommendationInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        movie={movie}
        isAnime={isAnime}
      />
    </>
  );
}
