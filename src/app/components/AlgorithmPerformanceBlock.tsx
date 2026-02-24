'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

interface AlgorithmPerformanceData {
  success: boolean;
  overall: { rate: number; accepted: number; shown: number; negative: number };
  byAlgorithm: Array<{
    algorithm: string;
    rate: number;
    accepted: number;
    shown: number;
    negative: number;
    dropped: number;
    hidden: number;
    lastUsed: string | null;
    healthStatus: 'ok' | 'warning' | 'critical';
  }>;
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

function AlgorithmCard({ 
  name, 
  data 
}: { 
  name: string; 
  data: { shown: number; accepted: number; negative: number; rate: number; dropped: number; hidden: number; lastUsed: string | null; healthStatus: 'ok' | 'warning' | 'critical' };
}) {
  const getStatusColor = (rate: number) => {
    if (rate >= 0.7) return 'text-green-400';
    if (rate >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthIcon = (status: 'ok' | 'warning' | 'critical') => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'warning': return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      case 'critical': return <XCircle className="w-3 h-3 text-red-400" />;
    }
  };

  const getHealthLabel = (status: 'ok' | 'warning' | 'critical') => {
    switch (status) {
      case 'ok': return 'Ок';
      case 'warning': return 'Тревога';
      case 'critical': return 'Критично';
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-800/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-right w-16">
          <p className={`text-lg font-bold ${getStatusColor(data.rate / 100)}`}>
            {formatPercent(data.rate / 100)}
          </p>
          <p className="text-gray-500 text-xs">% Точности</p>
        </div>
        <div>
          <p className="text-white font-medium text-sm">{name}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {formatNumber(data.shown)} показов · {formatNumber(data.accepted)} успешных
            <span className="text-red-400"> · {formatNumber(data.negative)} негативных</span>
          </p>
          {data.dropped > 0 && data.hidden > 0 && (
            <p className="text-gray-500 text-xs">
              (Брошено: {formatNumber(data.dropped)} · Скрыто: {formatNumber(data.hidden)})
            </p>
          )}
          <p className="text-gray-500 text-xs">
            {formatLastUsed(data.lastUsed)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
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
  const [stats, setStats] = useState<AlgorithmPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/recommendations/ml-stats');
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      
      if (data.algorithmPerformance) {
        const byAlgorithm = Object.entries(data.algorithmPerformance).map(([algorithm, perf]: [string, any]) => ({
          algorithm,
          rate: perf.successRate * 100,
          accepted: perf.success,
          shown: perf.total,
          negative: perf.negative || 0,
          dropped: perf.dropped || 0,
          hidden: perf.hidden || 0,
          lastUsed: perf.lastUsed || null,
          healthStatus: perf.healthStatus || 'critical',
        }));
        
        const totalShown = byAlgorithm.reduce((sum, a) => sum + a.shown, 0);
        const totalAccepted = byAlgorithm.reduce((sum, a) => sum + a.accepted, 0);
        const totalNegative = byAlgorithm.reduce((sum, a) => sum + a.negative, 0);
        
        setStats({
          success: true,
          overall: {
            rate: totalShown > 0 ? (totalAccepted / totalShown) * 100 : 0,
            accepted: totalAccepted,
            shown: totalShown,
            negative: totalNegative,
          },
          byAlgorithm,
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

  const hasAlgorithms = stats.byAlgorithm.length > 0;
  const allHealthy = hasAlgorithms && stats.byAlgorithm.every(a => a.healthStatus === 'ok');

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Заголовок */}
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
        {allHealthy ? (
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

      {/* Алгоритмы */}
      <div className="space-y-2">
        {stats.byAlgorithm
          .sort((a, b) => b.shown - a.shown)
          .map((algo) => (
            <AlgorithmCard
              key={algo.algorithm}
              name={algo.algorithm}
              data={algo}
            />
          ))}
      </div>

      {/* Время обновления */}
      <p className="text-gray-500 text-xs text-right mt-4">
        Обновлено: {new Date().toLocaleTimeString('ru-RU')}
      </p>
    </div>
  );
}
