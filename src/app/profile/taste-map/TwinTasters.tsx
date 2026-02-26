'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

interface SimilarUser {
  userId: string;
  overallMatch: number;
  watchCount: number;
  memberSince: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
}

interface TwinTastersProps {
  userId: string;
}

export default function TwinTasters({ userId }: TwinTastersProps) {
  const [twins, setTwins] = useState<SimilarUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0 });
  const router = useRouter();

  useEffect(() => {
    const loadTwins = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/user/similar-users?limit=15', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.similarUsers && data.similarUsers.length > 0) {
          setTwins(data.similarUsers);
          setError(null);
        } else {
          setError(data.message || 'Похожих пользователей не найдено');
          setTwins([]);
        }
      } catch (err) {
        logger.error('Failed to load similar users', {
          error: err instanceof Error ? err.message : String(err),
          context: 'TwinTasters',
        });
        setError('Ошибка при загрузке похожих пользователей');
        setTwins([]);
      } finally {
        setLoading(false);
      }
    };

    loadTwins();
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-gray-900 rounded-lg border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">Ваши близнецы вкуса</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          <span className="ml-3 text-gray-400">Поиск похожих кинозрителей...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-6 bg-gray-900 rounded-lg border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">Ваши близнецы вкуса</h2>
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-2">
            Добавьте больше фильмов в фильмотеку, чтобы мы могли найти пользователей с похожим вкусом
          </p>
        </div>
      </div>
    );
  }

  if (twins.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.ceil(diffDays / 30);
    const diffYears = Math.ceil(diffMonths / 12);

    if (diffDays < 1) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дня назад`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} неделю назад`;
    if (diffMonths < 12) return `${diffMonths} месяца назад`;
    return `${diffYears} года назад`;
  };

  return (
    <div className="mt-8 p-6 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Ваши близнецы вкуса</h2>
        <button
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ visible: true, x: rect.left, y: rect.top });
          }}
          onMouseLeave={() => setTooltip({ ...tooltip, visible: false })}
          className="text-gray-400 hover:text-purple-400 transition-colors"
          title="Узнать как считается сходство"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <p className="text-gray-400 text-sm mb-6">
        Пользователи с похожим профилем предпочтений. Процент показывает общее сходство вкуса.
      </p>

      {tooltip.visible && (
        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-xs text-blue-200">
          <p className="font-semibold mb-2">Как рассчитывается сходство:</p>
          <ul className="space-y-1 text-blue-300">
            <li>🎬 <strong>Совпадение по фильмам (50%)</strong> - совпадение оценок на одинаковые фильмы</li>
            <li>🎭 <strong>Жанры (30%)</strong> - сходство предпочитаемых жанров фильмов</li>
            <li>👥 <strong>Персоны (20%)</strong> - пересечение любимых актеров и режиссеров</li>
          </ul>
        </div>
      )}

      <div className="grid gap-3">
        {twins.map((twin) => (
          <div
            key={twin.userId}
            onClick={() => router.push(`/profile/taste-map/compare/${twin.userId}`)}
            className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-purple-500 hover:bg-gray-750 hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {twin.userId.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    Киномана {twin.userId.substring(0, 8)}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {twin.watchCount} фильм{
                      twin.watchCount % 10 === 1 && twin.watchCount % 100 !== 11
                        ? ''
                        : twin.watchCount % 10 >= 2 && twin.watchCount % 10 <= 4 && (twin.watchCount % 100 < 10 || twin.watchCount % 100 >= 20)
                          ? 'а'
                          : 'ов'
                    } в фильмотеке • Присоединился {formatDate(twin.memberSince)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-lg font-bold text-green-400">
                  {twin.overallMatch.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">совпадение</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-gray-800/50 rounded text-xs text-gray-400">
        <p>
          💡 <strong>Совет:</strong> Посмотрите фильмы из фильмотек близнецов, которые вы еще не видели — они вам точно понравятся!
        </p>
      </div>
    </div>
  );
}
