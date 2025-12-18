// src/app/components/MovieCard.tsx
'use client';

import Image from 'next/image';
import { Movie } from '@/lib/tmdb';

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  const imageUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : '/placeholder-poster.svg';

  return (
    <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 group cursor-pointer">
      <div className="relative w-full h-full">
        <Image
          src={imageUrl}
          alt={movie.title || 'Фильм без названия'}
          fill
          className="object-cover group-hover:opacity-80 transition-opacity"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 15vw"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
            {movie.title}
          </h3>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="text-yellow-400 mr-1">★</span>
              <span className="text-white">{movie.vote_average?.toFixed(1)}</span>
            </div>
            <span className="text-gray-300">
              {movie.release_date?.split('-')[0] || 'Нет года'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}