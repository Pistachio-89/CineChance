'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Film, Monitor, Tv } from 'lucide-react';
import Link from 'next/link';

interface UserStats {
  total: {
    watched: number;
    wantToWatch: number;
    dropped: number;
    hidden: number;
    totalForPercentage: number;
  };
  typeBreakdown: {
    movie: number;
    tv: number;
    cartoon: number;
    anime: number;
  };
  averageRating: number | null;
  ratedCount: number;
  ratingDistribution: Record<number, number>;
}

function StatsCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="h-3 w-16 bg-gray-700 rounded mb-2"></div>
      <div className="h-6 w-20 bg-gray-700 rounded"></div>
    </div>
  );
}

export default function ProfileStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/user/stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            total: {
              watched: data.total?.watched || 0,
              wantToWatch: data.total?.wantToWatch || 0,
              dropped: data.total?.dropped || 0,
              hidden: data.total?.hidden || 0,
              totalForPercentage: data.total?.totalForPercentage || 0,
            },
            typeBreakdown: {
              movie: data.typeBreakdown?.movie || 0,
              tv: data.typeBreakdown?.tv || 0,
              cartoon: data.typeBreakdown?.cartoon || 0,
              anime: data.typeBreakdown?.anime || 0,
            },
            averageRating: data.averageRating || null,
            ratedCount: data.ratedCount || 0,
            ratingDistribution: data.ratingDistribution || {},
          });
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Статистика</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[1, 2, 3, 4].map(i => <StatsCardSkeleton key={i} />)}
        </div>
      ) : stats?.total ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Всего просмотрено */}
            <Link
              href="/my-movies?tab=watched"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-green-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
            >
              <p className="text-gray-400 text-xs md:text-sm mb-2">Просмотрено</p>
              <p className="text-xl md:text-2xl font-bold text-green-400">{stats.total.watched}</p>
            </Link>

            {/* Хочу посмотреть */}
            <Link
              href="/my-movies?tab=want"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
            >
              <p className="text-gray-400 text-xs md:text-sm mb-2">Хочу посмотреть</p>
              <p className="text-xl md:text-2xl font-bold text-blue-400">{stats.total.wantToWatch}</p>
            </Link>

            {/* Брошено */}
            <Link
              href="/my-movies?tab=dropped"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-red-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
            >
              <p className="text-gray-400 text-xs md:text-sm mb-2">Брошено</p>
              <p className="text-xl md:text-2xl font-bold text-red-400">{stats.total.dropped}</p>
            </Link>

            {/* Скрыто */}
            <Link
              href="/my-movies?tab=hidden"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-yellow-500/50 hover:bg-gray-800/80 transition cursor-pointer block"
            >
              <p className="text-gray-400 text-xs md:text-sm mb-2">Скрыто</p>
              <p className="text-xl md:text-2xl font-bold text-yellow-400">{stats.total.hidden}</p>
            </Link>
          </div>

          {/* Breakdown по типам*/}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Фильмы */}
            <Link
              href="/my-movies?tab=watched&media=movie"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-800/80 transition block"
            >
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-4 h-4 text-purple-400" />
                <p className="text-gray-400 text-xs md:text-sm">Фильмы</p>
              </div>
              <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.movie}</p>
            </Link>

            {/* Сериалы */}
            <Link
              href="/my-movies?tab=watched&media=tv"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-cyan-500/50 hover:bg-gray-800/80 transition block"
            >
              <div className="flex items-center gap-2 mb-2">
                <Tv className="w-4 h-4 text-cyan-400" />
                <p className="text-gray-400 text-xs md:text-sm">Сериалы</p>
              </div>
              <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.tv}</p>
            </Link>

            {/* Мультфильмы */}
            <Link
              href="/my-movies?tab=watched&media=cartoon"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-pink-500/50 hover:bg-gray-800/80 transition block"
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-pink-400" />
                <p className="text-gray-400 text-xs md:text-sm">Мультфильмы</p>
              </div>
              <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.cartoon}</p>
            </Link>

            {/* Аниме */}
            <Link
              href="/my-movies?tab=watched&media=anime"
              className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 hover:border-indigo-500/50 hover:bg-gray-800/80 transition block"
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <p className="text-gray-400 text-xs md:text-sm">Аниме</p>
              </div>
              <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.anime}</p>
            </Link>
          </div>

          {/* Средняя оценка и рейтинг распределение */}
          {stats.ratedCount > 0 && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
                <p className="text-gray-400 text-xs md:text-sm mb-2">Средняя оценка</p>
                <p className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {stats.averageRating?.toFixed(1) || '–'}
                </p>
                <p className="text-gray-500 text-xs mt-1">из {stats.ratedCount} оценённых</p>
              </div>

              <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
                <p className="text-gray-400 text-xs md:text-sm mb-3">Распределение оценок</p>
                <div className="space-y-1">
                  {[10, 9, 8, 7].map(rating => (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-6">{rating}</span>
                      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: stats.ratedCount > 0
                              ? `${((stats.ratingDistribution[rating] || 0) / stats.ratedCount) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-right">
                        {stats.ratingDistribution[rating] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
