'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

interface MLStatsData {
  success: boolean;
  overview: {
    totalRecommendations: number;
    totalShown: number;
    totalAddedToWant: number;
    totalWatched: number;
    totalDropped: number;
    totalHidden: number;
    uniqueUsersWithRecs: number;
    acceptanceRate: number;
    wantRate: number;
    watchRate: number;
  };
  algorithmPerformance: Record<string, {
    total: number;
    success: number;
    failure: number;
    successRate: number;
    negative: number;
    dropped: number;
    hidden: number;
  }>;
  userSegments: {
    totalUsers: number;
    coldStart: number;
    activeUsers: number;
    heavyUsers: number;
    coldStartThreshold: number;
    heavyUserThreshold: number;
  };
  discrepancy: {
    predicted: number;
    actual: number;
    accuracy: number;
  };
  corrections: {
    active: number;
    pending: number;
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(1) + '%';
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-gray-400 text-sm">{title}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function AlgorithmCard({ 
  name, 
  data 
}: { 
  name: string; 
  data: { total: number; success: number; failure: number; successRate: number; negative: number; dropped: number; hidden: number };
}) {
  const getStatusColor = (rate: number) => {
    if (rate >= 0.7) return 'text-green-400';
    if (rate >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-800/30 rounded-lg">
      <div className="flex-1">
        <p className="text-white font-medium text-sm">{name}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {formatNumber(data.total)} показов · {formatNumber(data.success)} успешных
          {data.negative > 0 && (
            <span className="text-red-400"> · {formatNumber(data.negative)} негативных</span>
          )}
        </p>
        {data.dropped > 0 && data.hidden > 0 && (
          <p className="text-gray-500 text-xs">
            (Брошено: {formatNumber(data.dropped)} · Скрыто: {formatNumber(data.hidden)})
          </p>
        )}
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${getStatusColor(data.successRate)}`}>
          {formatPercent(data.successRate)}
        </p>
        <p className="text-gray-500 text-xs">успех</p>
      </div>
    </div>
  );
}

function DiscrepancyCard({ 
  predicted, 
  actual, 
  accuracy 
}: { 
  predicted: number; 
  actual: number; 
  accuracy: number;
}) {
  const getAccuracyColor = (acc: number) => {
    if (acc >= 0.8) return 'text-green-400';
    if (acc >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-400/10">
          <Activity className="w-5 h-5 text-purple-400" />
        </div>
        <span className="text-gray-400 text-sm">Предсказание vs Факт</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-1">Предсказано</p>
          <p className="text-xl font-bold text-blue-400">{formatNumber(predicted)}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-1">Фактически</p>
          <p className="text-xl font-bold text-green-400">{formatNumber(actual)}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-1">Точность</p>
          <p className={`text-xl font-bold ${getAccuracyColor(accuracy)}`}>
            {formatPercent(accuracy)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SegmentCard({
  totalUsers,
  coldStart,
  active,
  heavy
}: {
  totalUsers: number;
  coldStart: number;
  active: number;
  heavy: number;
}) {
  const total = coldStart + active + heavy;
  const coldPercent = total > 0 ? coldStart / total : 0;
  const activePercent = total > 0 ? active / total : 0;
  const heavyPercent = total > 0 ? heavy / total : 0;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-400/10">
          <Users className="w-5 h-5 text-orange-400" />
        </div>
        <span className="text-gray-400 text-sm">Сегменты пользователей ({formatNumber(totalUsers)} польз.)</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-blue-400">Холодный старт</span>
            <span className="text-white">{formatNumber(coldStart)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all"
              style={{ width: `${coldPercent * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-green-400">Активные</span>
            <span className="text-white">{formatNumber(active)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 transition-all"
              style={{ width: `${activePercent * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-purple-400">Тяжёлые</span>
            <span className="text-white">{formatNumber(heavy)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 transition-all"
              style={{ width: `${heavyPercent * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MLDashboard() {
  const [stats, setStats] = useState<MLStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/recommendations/ml-stats');
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Обновляем каждые 5 минут
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <h3 className="text-lg font-semibold text-white">ML Мониторинг</h3>
        </div>
        <p className="text-gray-400 text-sm">Загрузка ML статистики...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-red-800/50">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">ML Мониторинг</h3>
        </div>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Пассивные рекомендации</h3>
          <button
            onClick={fetchStats}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {stats.success && stats.overview.totalRecommendations > 0 ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400/10 text-green-400 rounded-full text-xs border border-green-400/30">
              <CheckCircle className="w-3.5 h-3.5" />
              Ок
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 text-red-400 rounded-full text-xs border border-red-400/30">
              <AlertCircle className="w-3.5 h-3.5" />
              Есть проблемы
            </span>
          )}
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Пассивные рекомендации"
          value={formatNumber(stats.overview.totalRecommendations)}
          subtitle="сгенерировано"
          icon={Brain}
          color="bg-blue-400/10 text-blue-400"
        />
        <StatCard
          title="Показано"
          value={formatNumber(stats.overview.totalShown)}
          subtitle="пользователям"
          icon={Target}
          color="bg-purple-400/10 text-purple-400"
        />
        <StatCard
          title="Добавлено в хочу"
          value={formatNumber(stats.overview.totalAddedToWant)}
          subtitle={formatPercent(stats.overview.wantRate)}
          icon={TrendingUp}
          color="bg-green-400/10 text-green-400"
        />
        <StatCard
          title="Просмотрено"
          value={formatNumber(stats.overview.totalWatched)}
          subtitle={formatPercent(stats.overview.watchRate)}
          icon={CheckCircle}
          color="bg-emerald-400/10 text-emerald-400"
        />
      </div>

      {/* Секции */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Сегменты пользователей */}
        <SegmentCard
          totalUsers={stats.userSegments.totalUsers}
          coldStart={stats.userSegments.coldStart}
          active={stats.userSegments.activeUsers}
          heavy={stats.userSegments.heavyUsers}
        />

        {/* Discrepancy */}
        <DiscrepancyCard
          predicted={stats.discrepancy.predicted}
          actual={stats.discrepancy.actual}
          accuracy={stats.discrepancy.accuracy}
        />
      </div>

      {/* Модель коррекции */}
      {stats.corrections.active > 0 && (
        <div className="mt-4 p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <p className="text-yellow-400 text-sm">
              {stats.corrections.active} активных коррекций модели применяются к рекомендациям
            </p>
          </div>
        </div>
      )}

      {/* Время обновления */}
      <p className="text-gray-500 text-xs text-right mt-4">
        Обновлено: {new Date().toLocaleTimeString('ru-RU')}
      </p>
    </div>
  );
}
