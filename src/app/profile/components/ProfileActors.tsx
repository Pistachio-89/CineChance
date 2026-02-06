'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ActorAchievement {
  id: number;
  name: string;
  profile_path: string | null;
  watched_movies: number;
  rewatched_movies: number;
  dropped_movies: number;
  total_movies: number;
  progress_percent: number;
  average_rating: number | null;
  actor_score: number;
}

function ActorsSkeleton() {
  return (
    <div className="space-y-3 md:space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-gray-900 rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-800 animate-pulse">
          <div className="h-4 w-32 bg-gray-700 rounded mb-2"></div>
          <div className="h-2 w-20 bg-gray-700 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export default function ProfileActors() {
  const [actors, setActors] = useState<ActorAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActors = async () => {
      try {
        const res = await fetch('/api/user/achiev_actors?limit=50&singleLoad=true');
        if (res.ok) {
          const data = await res.json();
          setActors((data.actors || []).slice(0, 5));
        }
      } catch (error) {
        console.error('Error loading actors:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActors();
  }, []);

  if (isLoading) {
    return <ActorsSkeleton />;
  }

  if (!actors || actors.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Любимые актёры</h2>
      </div>

      <div className="space-y-2 md:space-y-3">
        {actors.map((actor, index) => (
          <Link
            key={actor.id}
            href={`/person/${actor.id}`}
            className="block bg-gray-900 rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800/80 transition"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                {actor.profile_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`}
                    alt={actor.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                    No image
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-semibold text-white truncate">
                  {index + 1}. {actor.name}
                </p>
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 mt-0.5">
                  <span>Просмотрено: {actor.watched_movies}</span>
                  {actor.rewatched_movies > 0 && (
                    <span className="text-yellow-400">({actor.rewatched_movies}x)</span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-lg md:text-xl font-bold text-blue-400">
                  {actor.average_rating?.toFixed(1) || '–'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {actor.watched_movies}/{actor.total_movies}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
