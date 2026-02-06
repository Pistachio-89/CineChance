'use client';

import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface CollectionAchievement {
  id: number;
  name: string;
  poster_path: string | null;
  total_movies: number;
  added_movies: number;
  watched_movies: number;
  progress_percent: number;
  average_rating: number | null;
}

function CollectionsSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="h-5 w-32 bg-gray-700 rounded mb-3"></div>
      <div className="h-32 bg-gray-800 rounded"></div>
    </div>
  );
}

export default function ProfileCollections() {
  const [collections, setCollections] = useState<CollectionAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const res = await fetch('/api/user/achiev_collection?limit=50&singleLoad=true');
        if (res.ok) {
          const data = await res.json();
          setCollections((data.collections || []).slice(0, 5));
        }
      } catch (error) {
        console.error('Error loading collections:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, []);

  if (isLoading) {
    return <CollectionsSkeleton />;
  }

  if (!collections || collections.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h2 className="text-lg font-semibold text-white">Коллекции</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map(collection => (
          <Link
            key={collection.id}
            href={`/collection/${collection.id}`}
            className="bg-gray-900 rounded-lg md:rounded-xl border border-gray-800 hover:border-blue-500/50 transition overflow-hidden flex flex-col h-full"
          >
            <div className="relative aspect-video bg-gray-800">
              {collection.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${collection.poster_path}`}
                  alt={collection.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  No image
                </div>
              )}
            </div>
            <div className="p-3 md:p-4 flex-1 flex flex-col">
              <h3 className="text-sm md:text-base font-semibold text-white mb-2 line-clamp-2">
                {collection.name}
              </h3>
              <div className="mt-auto space-y-2">
                <div className="flex justify-between text-xs md:text-sm text-gray-400">
                  <span>{collection.watched_movies} / {collection.total_movies}</span>
                  <span>{Math.round(collection.progress_percent)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${collection.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
