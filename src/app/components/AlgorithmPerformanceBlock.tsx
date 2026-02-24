'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface ApiStats {
  calls: number;
  returns: number;
  accuracy: number;
}

interface AlgorithmStats {
  name: string;
  uses: number;
  positive?: number;
  negative?: number;
  lastUsed: string | null;
  healthStatus: 'ok' | 'warning' | 'critical';
}

interface CombinedStatsData {
  success: boolean;
  apiStats: {
    active: ApiStats;
    passive: ApiStats;
  };
  algorithmStats: AlgorithmStats[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatPercent(num: number): string {
  return (num * 100).toFixed(1) + '%';
}

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return 'Никогда';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Только что';
  if (diffHours < 24) return `${diffHours}ч назад`;
  if (diffDays < 7) return `${diffDays}д назад`;
  return `${diffDays}д назад`;
}

function getHealthIcon(status: 'ok' | 'warning' | 'critical') {
  switch (status) {
    case 'ok': return <CheckCircle className="w-3 h-3 text-green-400" />;
    case 'warning': return <AlertCircle className="w-3 h-3 text-yellow-400" />;
    case 'critical': return <XCircle className="w-3 h-3 text-red-400" />;
  }
}

function getHealthLabel(status: 'ok' | 'warning' | 'critical') {
  switch (status) {
    case 'ok': return 'Ок';
    case 'warning': return 'Тревога';
    case 'critical': return 'Критично';
  }
}

function getAccuracyColor(acc: number) {
  if (acc >= 0.3) return 'text-green-400';
  if (acc >= 0.1) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * API Row - Shows metrics for API endpoints
 * Has accuracy because user interactions are tracked at API level
 */
function ApiRow({ 
  name, 
  stats,
}: { 
  name: string; 
  stats: ApiStats;
}) {
  const healthStatus: 'ok' | 'warning' | 'critical' = stats.calls > 0 ? 'ok' : 'critical';

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-right w-16">
          <p className={`font-semibold ${getAccuracyColor(stats.accuracy)}`}>
            {formatPercent(stats.accuracy)}
          </p>
          <p className="text-gray-500 text-xs">Точность</p>
        </div>
        <div>
          <p className="text-white text-sm">{name}</p>
          <p className="text-gray-400 text-xs">
            {formatNumber(stats.calls)} вызовов · {formatNumber(stats.returns)} возвращено
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {getHealthIcon(healthStatus)}
        <span className={`text-xs ${
          healthStatus === 'ok' ? 'text-green-400' : 'text-red-400'
        }`}>
          {getHealthLabel(healthStatus)}
        </span>
      </div>
    </div>
  );
}

/**
 * Algorithm Row - Shows metrics for individual algorithms
 * NO accuracy - algorithms don't directly interact with users
 * Shows: uses count, positive/negative outcomes, lastUsed, healthStatus
 */
function AlgorithmRow({ 
  data 
}: { 
  data: AlgorithmStats;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-right w-16">
          <p className="font-semibold text-white">
            {formatNumber(data.uses)}
          </p>
        </div>
        <div>
          <p className="text-white text-sm">{data.name}</p>
          <p className="text-gray-400 text-xs">
            {formatLastUsed(data.lastUsed)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {data.positive !== undefined && data.positive > 0 && (
          <span className="text-green-400">
            +{formatNumber(data.positive)}
          </span>
        )}
        {data.negative !== undefined && data.negative > 0 && (
          <span className="text-red-400">
            -{formatNumber(data.negative)}
          </span>
        )}
        {getHealthIcon(data.healthStatus)}
        <span className={`text-xs ${
          data.healthStatus === 'ok' ? 'text-green-400' : 
          data.healthStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {getHealthLabel(data.healthStatus)}
        </span>
      </div>
    </div>
  );
}

export default function AlgorithmPerformanceBlock() {
  const [stats, setStats] = useState<CombinedStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/recommendations/ml-stats');
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      
      if (data.apiStats && data.algorithmStats) {
        setStats({
          success: data.success,
          apiStats: data.apiStats,
          algorithmStats: data.algorithmStats,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <h3 className="text-lg font-semibold text-white">Производительность алгоритмов</h3>
        </div>
        <p className="text-gray-400 text-sm">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-red-800/50">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Производительность алгоритмов</h3>
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

  // Check overall health - any algorithm with warning or critical
  const hasIssues = stats.algorithmStats.some(a => a.healthStatus !== 'ok');

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Производительность алгоритмов</h3>
          <button
            onClick={fetchStats}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>
        {hasIssues ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 text-yellow-400 rounded-full text-xs border border-yellow-400/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Есть проблемы
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400/10 text-green-400 rounded-full text-xs border border-green-400/30">
            <CheckCircle className="w-3.5 h-3.5" />
            Ок
          </span>
        )}
      </div>

      {/* API Level Stats */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm mb-3">Уровень API:</p>
        <div className="space-y-2">
          <ApiRow
            name="/api/recommendations/random"
            stats={stats.apiStats.active}
          />
          <ApiRow
            name="/api/recommendations/patterns"
            stats={stats.apiStats.passive}
          />
        </div>
      </div>

      {/* Algorithm Level Stats */}
      <div>
        <p className="text-gray-400 text-sm mb-3">Уровень алгоритмов:</p>
        <div className="space-y-2">
          {stats.algorithmStats
            .sort((a, b) => b.uses - a.uses)
            .map((algo) => (
              <AlgorithmRow key={algo.name} data={algo} />
            ))}
        </div>
      </div>

      {/* Update time */}
      <p className="text-gray-500 text-xs text-right mt-4">
        Обновлено: {new Date().toLocaleTimeString('ru-RU')}
      </p>
    </div>
  );
}
