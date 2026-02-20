'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Star, Tag as TagIcon, Music, ArrowLeft, Film, Tv, Monitor } from 'lucide-react';

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

interface TagUsage {
  id: string;
  name: string;
  count: number;
}

interface GenreData {
  id: number;
  name: string;
  count: number;
}

interface AdminStatsClientProps {
  userId: string;
  userName: string | null;
  userEmail: string;
}

function AverageRatingSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
      <div className="flex items-end gap-3">
        <div className="h-10 w-16 bg-gray-700 rounded"></div>
        <div className="flex-1 pb-1">
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="w-4 h-4 bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-3 w-20 bg-gray-800 rounded"></div>
        </div>
      </div>
    </div>
  );
}

function TagsSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-7 w-20 bg-gray-700 rounded-full"></div>
        ))}
      </div>
    </div>
  );
}

function GenresSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-700 rounded"></div>
        <div className="h-4 w-24 bg-gray-700 rounded"></div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-700 rounded"></div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <div className="h-4 w-16 bg-gray-700 rounded"></div>
                <div className="h-4 w-8 bg-gray-700 rounded"></div>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-gray-700 rounded-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminStatsClient({ userId, userName, userEmail }: AdminStatsClientProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [averageRatingLoading, setAverageRatingLoading] = useState(true);
  const [tagUsage, setTagUsage] = useState<TagUsage[]>([]);
  const [tagUsageLoading, setTagUsageLoading] = useState(true);
  const [watchedGenres, setWatchedGenres] = useState<GenreData[]>([]);
  const [watchedGenresLoading, setWatchedGenresLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleTypeFilterClick = (type: string) => {
    if (typeFilter === type) {
      setTypeFilter(null);
    } else {
      setTypeFilter(type);
    }
  };

  const getCardClasses = (cardType: string) => {
    const baseClasses = "bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border transition block cursor-pointer";
    
    if (typeFilter === null) {
      return baseClasses;
    }
    
    if (typeFilter === cardType) {
      return `${baseClasses} border-purple-500 bg-gray-800`;
    }
    
    return `${baseClasses} border-gray-800 opacity-50`;
  };

  const getProgressMessage = () => {
    if (progress < 20) return '📊 Собираем статистику оценок...';
    if (progress < 40) return '🏷️ Анализируем теги...';
    if (progress < 60) return '🎬 Обрабатываем жанры...';
    if (progress < 80) return '⭐ Формируем рейтинги...';
    if (progress < 95) return '📈 Готовим данные...';
    return '✨ Почти готово...';
  };

  const getProgressSubtext = () => {
    if (progress < 20) return 'Считаем оценки и их распределение';
    if (progress < 40) return 'Анализируем использование тегов';
    if (progress < 60) return 'Определяем любимые жанры';
    if (progress < 80) return 'Вычисляем средние значения';
    if (progress < 95) return 'Подготавливаем визуализацию';
    return 'Скоро покажем результат!';
  };

  useEffect(() => {
    const loadDataInParallel = async () => {
      try {
        setProgress(0);

        progressIntervalRef.current = setInterval(() => {
          setProgress(prev => {
            if (prev < 70) {
              return Math.min(prev + Math.random() * 3 + 1, 70);
            } else if (prev < 85) {
              return Math.min(prev + Math.random() * 1 + 0.5, 85);
            } else {
              return prev;
            }
          });
        }, 200);

        const statsUrl = typeFilter 
          ? `/api/admin/users/${userId}/stats?media=${typeFilter}` 
          : `/api/admin/users/${userId}/stats`;
        
        const tagUsageUrl = typeFilter 
          ? `/api/admin/users/${userId}/tag-usage?media=${typeFilter}` 
          : `/api/admin/users/${userId}/tag-usage`;
        
        const genresUrl = typeFilter 
          ? `/api/admin/users/${userId}/genres?media=${typeFilter}` 
          : `/api/admin/users/${userId}/genres`;
        
        const [statsRes, tagUsageRes, genresRes] = await Promise.all([
          fetch(statsUrl),
          fetch(tagUsageUrl),
          fetch(genresUrl),
        ]);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }

        setProgress(90);

        if (statsRes.ok) {
          const data = await statsRes.json();
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
        setStatsLoading(false);
        setAverageRatingLoading(false);

        if (tagUsageRes.ok) {
          const data = await tagUsageRes.json();
          setTagUsage(data.tags || []);
        }
        setTagUsageLoading(false);

        if (genresRes.ok) {
          const data = await genresRes.json();
          setWatchedGenres(data.genres || []);
        }
        setWatchedGenresLoading(false);

        setProgress(100);
        setTimeout(() => setProgress(0), 500);

      } catch (error) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        
        setStatsLoading(false);
        setAverageRatingLoading(false);
        setTagUsageLoading(false);
        setWatchedGenresLoading(false);
        setProgress(0);
      }
    };

    loadDataInParallel();

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [typeFilter, userId]);

  const isLoading = statsLoading || averageRatingLoading || tagUsageLoading || watchedGenresLoading;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Вернуться к списку пользователей</span>
      </Link>

      {/* User info header */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 md:p-6">
        <h2 className="text-xl font-bold text-white mb-2">
          {userName || 'Без имени'}
        </h2>
        <p className="text-gray-400 text-sm">{userEmail}</p>
      </div>

      {/* Type breakdown cards */}
      {!isLoading && stats?.typeBreakdown && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Фильмы */}
          <button
            onClick={() => handleTypeFilterClick('movie')}
            className={getCardClasses('movie')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4 text-purple-400" />
              <p className="text-gray-400 text-xs md:text-sm">Фильмы</p>
            </div>
            <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.movie}</p>
          </button>

          {/* Сериалы */}
          <button
            onClick={() => handleTypeFilterClick('tv')}
            className={getCardClasses('tv')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Tv className="w-4 h-4 text-cyan-400" />
              <p className="text-gray-400 text-xs md:text-sm">Сериалы</p>
            </div>
            <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.tv}</p>
          </button>

          {/* Мультфильмы */}
          <button
            onClick={() => handleTypeFilterClick('cartoon')}
            className={getCardClasses('cartoon')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-pink-400" />
              <p className="text-gray-400 text-xs md:text-sm">Мультфильмы</p>
            </div>
            <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.cartoon}</p>
          </button>

          {/* Аниме */}
          <button
            onClick={() => handleTypeFilterClick('anime')}
            className={getCardClasses('anime')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-indigo-400" />
              <p className="text-gray-400 text-xs md:text-sm">Аниме</p>
            </div>
            <p className="text-lg md:text-xl font-bold text-white">{stats.typeBreakdown.anime}</p>
          </button>
        </div>
      )}

      {isLoading && progress > 0 && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-full max-w-xs">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-xs text-center">{Math.round(progress)}%</p>
          </div>
          <div className="text-center mt-4">
            <p className="text-gray-300 text-sm mb-1">
              {getProgressMessage()}
            </p>
            <p className="text-gray-500 text-xs">
              {getProgressSubtext()}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {averageRatingLoading ? (
          <AverageRatingSkeleton />
        ) : stats?.averageRating !== null ? (
          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-white">Средняя оценка</h3>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-4xl md:text-5xl font-bold text-white">
                {stats?.averageRating?.toFixed(1) || '-'}
              </span>
              <div className="flex-1 pb-1">
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        (stats?.averageRating || 0) >= star 
                          ? 'text-yellow-400 fill-yellow-400' 
                          : 'text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-gray-500 text-xs">
                  {stats?.ratedCount || 0} оценённых
                </p>
              </div>
            </div>

            {stats?.ratingDistribution && (() => {
              const distribution = stats.ratingDistribution;
              const totalRatings = Object.values(distribution).reduce((sum, count) => sum + count, 0);
              
              if (totalRatings === 0) {
                return null;
              }
              
              const maxValue = Math.max(...Object.values(distribution), 0);
              
              return (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="space-y-3">
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((rating) => {
                      const count = distribution[rating] || 0;
                      if (count === 0) return null;
                      
                      const barWidth = maxValue > 0 ? (count / maxValue) * 100 : 0;
                      
                      return (
                        <div
                          key={rating}
                          className="flex items-center gap-3 group hover:opacity-80 transition"
                        >
                          <div className="relative w-7 h-7 flex-shrink-0 group-hover:scale-110 transition">
                            <svg 
                              width="28" 
                              height="28" 
                              viewBox="0 0 32 32" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                              className="absolute inset-0 w-full h-full"
                            >
                              <path 
                                d="M16 2L21 10L29 12L24 18L24 27L16 24L8 27L8 18L3 12L11 10L16 2Z" 
                                stroke="#FFD700" 
                                strokeWidth="1.5" 
                                fill="none"
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold z-10" style={{ transform: 'translateY(0.5px)' }}>
                              {rating}
                            </span>
                          </div>
                          
                          <div className="flex-1">
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                          
                          <span className="text-gray-300 text-xs w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        {tagUsageLoading ? (
          <TagsSkeleton />
        ) : tagUsage.length > 0 ? (
          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <TagIcon className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white">Теги пользователя</h3>
            </div>
            <div className="space-y-3">
              {tagUsage.map((tag) => {
                const totalTags = tagUsage.reduce((sum, t) => sum + t.count, 0);
                const percentage = totalTags > 0 ? (tag.count / totalTags) * 100 : 0;
                
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 group hover:opacity-80 transition"
                  >
                    <div className="w-5 h-5 bg-cyan-400/20 rounded flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-400/40 transition">
                      <TagIcon className="w-3 h-3 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300 text-sm group-hover:text-cyan-400 transition">{tag.name}</span>
                        <span className="text-white text-xs">{tag.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !tagUsageLoading && tagUsage.length === 0 ? (
          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <TagIcon className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white">Теги пользователя</h3>
            </div>
            <p className="text-gray-500 text-sm">Пока нет тегов.</p>
          </div>
        ) : null}

        {watchedGenresLoading ? (
          <GenresSkeleton />
        ) : watchedGenres.length > 0 ? (
          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-medium text-white">Жанры просмотренного</h3>
            </div>
            <div className="space-y-3">
              {watchedGenres.map((genre) => {
                const totalWatched = watchedGenres.reduce((sum, g) => sum + g.count, 0);
                const percentage = totalWatched > 0 ? (genre.count / totalWatched) * 100 : 0;
                
                return (
                  <div
                    key={genre.id}
                    className="flex items-center gap-3 group hover:opacity-80 transition"
                  >
                    <div className="w-5 h-5 bg-pink-400/20 rounded flex items-center justify-center flex-shrink-0 group-hover:bg-pink-400/40 transition">
                      <Music className="w-3 h-3 text-pink-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300 text-sm group-hover:text-pink-400 transition">{genre.name}</span>
                        <span className="text-white text-xs">{genre.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-pink-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !watchedGenresLoading && watchedGenres.length === 0 ? (
          <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-medium text-white">Жанры просмотренного</h3>
            </div>
            <p className="text-gray-500 text-sm">Жанры появятся после просмотра фильмов.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
