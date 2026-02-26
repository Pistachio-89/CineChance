'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { TasteMap } from '@/lib/taste-map/types';
import { logger } from '@/lib/logger';
import TwinTasters from './TwinTasters';

interface TasteMapClientProps {
  tasteMap: TasteMap | null;
  userId: string;
}

const COLORS = {
  high: '#22c55e', // green-500
  medium: '#eab308', // yellow-500
  low: '#ef4444', // red-500
  purple: '#a855f7', // purple-500
  amber: '#f59e0b', // amber-500
  blue: '#3b82f6', // blue-500
};

export default function TasteMapClient({ tasteMap, userId }: TasteMapClientProps) {
  const [topActors, setTopActors] = useState<Array<[string, number]>>([]);
  const [topDirectors, setTopDirectors] = useState<Array<[string, number]>>([]);
  const [loadingActors, setLoadingActors] = useState(false);
  const [loadingDirectors, setLoadingDirectors] = useState(false);

  // Load actors from PersonProfile table
  useEffect(() => {
    const loadActors = async () => {
      setLoadingActors(true);
      try {
        const response = await fetch(`/api/user/person-profile?personType=actor&limit=10`);
        if (response.ok) {
          const data = await response.json();
          const actorsList: Array<[string, number]> = (data.persons || []).map(
            (person: { name: string; avgWeightedRating: number }) => [
              person.name,
              person.avgWeightedRating,
            ]
          );
          setTopActors(actorsList);
        } else {
          // Fallback to old API if PersonProfile empty
          const fallbackResponse = await fetch(`/api/user/achiev_actors?limit=10&singleLoad=true&offset=0`);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            const actorsList: Array<[string, number]> = (data.actors || [])
              .slice(0, 10)
              .map((actor: ActorData) => [
                actor.name,
                actor.average_rating ?? 0,
              ]);
            setTopActors(actorsList);
          }
        }
      } catch (error) {
        logger.debug('Failed to load actors', { error, context: 'TasteMapClient' });
      } finally {
        setLoadingActors(false);
      }
    };
    
    loadActors();
  }, [userId]);

  // Load directors from PersonProfile table
  useEffect(() => {
    const loadDirectors = async () => {
      setLoadingDirectors(true);
      try {
        const response = await fetch(`/api/user/person-profile?personType=director&limit=10`);
        if (response.ok) {
          const data = await response.json();
          const directorsList: Array<[string, number]> = (data.persons || []).map(
            (person: { name: string; avgWeightedRating: number }) => [
              person.name,
              person.avgWeightedRating,
            ]
          );
          setTopDirectors(directorsList);
        } else {
          // Fallback to old API if PersonProfile empty
          const fallbackResponse = await fetch(`/api/user/achiev_creators?limit=10&singleLoad=true&offset=0`);
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            const directorsList: Array<[string, number]> = (data.creators || [])
              .slice(0, 10)
              .map((creator: DirectorData) => [
                creator.name,
                creator.average_rating ?? 0,
              ]);
            setTopDirectors(directorsList);
          }
        }
      } catch (error) {
        logger.debug('Failed to load directors', { error, context: 'TasteMapClient' });
      } finally {
        setLoadingDirectors(false);
      }
    };
    
    loadDirectors();
  }, [userId]);
  // Empty state
  if (!tasteMap || Object.keys(tasteMap.genreProfile).length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">🎬</div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Карта вкуса пуста
        </h2>
        <p className="text-gray-400 mb-4">
          Добавьте фильмы и сериалы в свой список, чтобы увидеть анализ ваших предпочтений.
        </p>
        <a
          href="/my-movies"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Добавить фильмы
        </a>
      </div>
    );
  }

  // Prepare genre data for horizontal bar chart (top 10)
  const genreEntries = Object.entries(tasteMap.genreProfile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const genreData = genreEntries.map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Prepare rating distribution for pie chart
  const ratingData = [
    { name: 'Высокие (8-10)', value: tasteMap.ratingDistribution.high, color: COLORS.high },
    { name: 'Средние (5-7)', value: tasteMap.ratingDistribution.medium, color: COLORS.medium },
    { name: 'Низкие (1-4)', value: tasteMap.ratingDistribution.low, color: COLORS.low },
  ].filter(d => d.value > 0);

  // Type breakdown data
  const typeData = [
    { name: 'Фильмы', value: tasteMap.ratingDistribution.high > 0 ? Math.round(tasteMap.ratingDistribution.high) : 0, color: COLORS.purple },
  ];
  if (tasteMap.ratingDistribution.medium > 0) {
    typeData.push({ name: 'Сериалы', value: tasteMap.ratingDistribution.medium, color: COLORS.blue });
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {tasteMap.averageRating.toFixed(1)}
          </div>
          <div className="text-sm text-gray-400">Средний рейтинг</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-500">
            {tasteMap.computedMetrics.positiveIntensity}%
          </div>
          <div className="text-sm text-gray-400">Положительные оценки</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">
            {tasteMap.computedMetrics.consistency}%
          </div>
          <div className="text-sm text-gray-400">Консистентность</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-500">
            {tasteMap.computedMetrics.diversity}%
          </div>
          <div className="text-sm text-gray-400">Разнообразие жанров</div>
        </div>
      </div>

      {/* Genre Profile - Horizontal Bar Chart */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Профиль жанров</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={genreData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                width={80}
                tick={{ fill: '#d1d5db', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => [`${value}`, 'Предпочтение']}
              />
              <Bar dataKey="value" fill="#a855f7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rating Distribution - Pie Chart */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Распределение оценок</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ratingData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={false}
              >
                {ratingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number) => [`${value}%`, 'Процент']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Actors */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Любимые актеры</h2>
        <div className="flex flex-wrap gap-2">
          {loadingActors ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : topActors.length > 0 ? (
            topActors.map(([name, score]) => (
              <a
                key={name}
                href="/profile/actors"
                className="bg-amber-900/30 text-amber-400 px-3 py-1 rounded-full text-sm border border-amber-700/50 hover:bg-amber-900/50 transition-colors"
              >
                {name} ({score > 0 ? score.toFixed(1) : '—'})
              </a>
            ))
          ) : (
            <p className="text-gray-400">Нет данных об актерах</p>
          )}
        </div>
      </div>

      {/* Top Directors */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Любимые режиссеры</h2>
        <div className="flex flex-wrap gap-2">
          {loadingDirectors ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : topDirectors.length > 0 ? (
            topDirectors.map(([name, score]) => (
              <a
                key={name}
                href="/profile/creators"
                className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-sm border border-blue-700/50 hover:bg-blue-900/50 transition-colors"
              >
                {name} ({score > 0 ? score.toFixed(1) : '—'})
              </a>
            ))
          ) : (
            <p className="text-gray-400">Нет данных о режиссерах</p>
          )}
        </div>
      </div>

      {/* Computed Metrics Details */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Метрики профиля</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-500">
              {tasteMap.computedMetrics.positiveIntensity}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Положительный настрой</div>
            <div className="text-xs text-gray-500 mt-2">
              Процент высоких оценок (8-10)
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-500">
              {tasteMap.computedMetrics.negativeIntensity}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Критический настрой</div>
            <div className="text-xs text-gray-500 mt-2">
              Процент низких оценок (1-4)
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-500">
              {tasteMap.computedMetrics.consistency}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Консистентность</div>
            <div className="text-xs text-gray-500 mt-2">
              Стабильность оценок
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-purple-500">
              {tasteMap.computedMetrics.diversity}%
            </div>
            <div className="text-sm text-gray-400 mt-1">Разнообразие</div>
            <div className="text-xs text-gray-500 mt-2">
              Количество предпочитаемых жанров
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Profile */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Поведенческий профиль</h2>
        <div className="text-sm text-gray-400 mb-4">
          Анализ ваших привычек просмотра: как часто вы пересматриваете понравившиеся фильмы, какой процент добавленного контента вы бросаете, и насколько успешно вы завершаете начатый контент.
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
            <div className="text-2xl font-bold text-purple-400">
              {tasteMap.behaviorProfile.rewatchRate}%
            </div>
            <div className="text-xs font-semibold text-gray-300 mb-2">Пересмотры</div>
            <div className="text-xs text-gray-500">
              Доля фильмов, пересмотренных более одного раза
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
            <div className="text-2xl font-bold text-red-400">
              {tasteMap.behaviorProfile.dropRate}%
            </div>
            <div className="text-xs font-semibold text-gray-300 mb-2">Брошено</div>
            <div className="text-xs text-gray-500">
              Процент брошенного контента из того, что вы захотели смотреть
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center hover:bg-gray-700 transition-colors">
            <div className="text-2xl font-bold text-green-400">
              {tasteMap.behaviorProfile.completionRate}%
            </div>
            <div className="text-xs font-semibold text-gray-300 mb-2">Завершение</div>
            <div className="text-xs text-gray-500">
              Процент просмотренного контента из всех добавленных
            </div>
          </div>
        </div>
      </div>

      {/* Twin Tasters / Similar Users */}
      <TwinTasters userId={userId} />
    </div>
  );
}
