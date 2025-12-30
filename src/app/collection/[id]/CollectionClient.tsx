// src/app/collection/[id]/CollectionClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MovieCard from '@/app/components/MovieCard';

interface CollectionMovie {
  id: number;
  media_type: 'movie';
  title: string;
  name: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  first_air_date: string;
  overview: string;
  status: 'want' | 'watched' | 'dropped' | null;
  userRating: number | null;
  isBlacklisted: boolean;
}

interface CollectionData {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: CollectionMovie[];
}

export default function CollectionClient({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collection/${collectionId}`);
        if (!res.ok) throw new Error('Failed to fetch collection');
        const data = await res.json();
        setCollection(data);
      } catch (err) {
        setError('Failed to load collection');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Загрузка...</div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error || 'Collection not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        {/* Заголовок и информация */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ← Назад
            </button>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {collection.name}
          </h1>
          
          {collection.overview && (
            <p className="text-gray-400 text-sm max-w-3xl">
              {collection.overview}
            </p>
          )}
        </div>

        {/* Список фильмов */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
            Фильмы серии ({collection.parts.length})
          </h2>
          
          {collection.parts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {collection.parts.map((movie, index) => (
                <div key={movie.id} className="p-1">
                  <MovieCard
                    movie={movie}
                    restoreView={movie.isBlacklisted}
                    initialStatus={movie.status}
                    showRatingBadge
                    priority={index < 6}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">
                В этой коллекции пока нет фильмов
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
