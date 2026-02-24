'use client';

import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, AlertCircle } from 'lucide-react';

interface AlgorithmStat {
  name: string;
  shown: number;
  positive: number;
  negative: number;
  lastUsed: string | null;
}

interface UserRecommendationAlgorithmsProps {
  userId: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
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

function AlgorithmRow({ algorithm }: { algorithm: AlgorithmStat }) {
  // Calculate positive rate
  const positiveRate = algorithm.shown > 0 
    ? (algorithm.positive / algorithm.shown) * 100 
    : 0;

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-right w-16">
          <p className="font-semibold text-white">
            {formatNumber(algorithm.shown)}
          </p>
        </div>
        <div>
          <p className="text-white text-sm">{algorithm.name}</p>
          <p className="text-gray-400 text-xs">
            {formatLastUsed(algorithm.lastUsed)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        {algorithm.positive > 0 && (
          <span className="text-green-400">
            +{algorithm.positive}
          </span>
        )}
        {algorithm.negative > 0 && (
          <span className="text-red-400">
            -{algorithm.negative}
          </span>
        )}
        {algorithm.shown > 0 && (
          <span className="text-gray-500">
            {positiveRate.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-16 h-6 bg-gray-700 rounded"></div>
        <div>
          <div className="w-32 h-4 bg-gray-700 rounded mb-1"></div>
          <div className="w-16 h-3 bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function UserRecommendationAlgorithms({ userId }: UserRecommendationAlgorithmsProps) {
  const [algorithms, setAlgorithms] = useState<AlgorithmStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/user/recommendation-algorithms?userId=${userId}`);
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      
      if (data.success && data.algorithms) {
        setAlgorithms(data.algorithms);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Алгоритмы рекомендаций</h3>
        </div>
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-red-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Алгоритмы рекомендаций</h3>
        </div>
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchStats}
          className="mt-3 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs transition"
        >
          Повторить
        </button>
      </div>
    );
  }

  // Empty state
  if (algorithms.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Алгоритмы рекомендаций</h3>
        </div>
        <p className="text-gray-500 text-sm">
          Пока нет данных. Рекомендации появятся после добавления фильмов в список.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg md:rounded-xl p-4 md:p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Алгоритмы рекомендаций</h3>
        </div>
        <button
          onClick={fetchStats}
          className="p-1 hover:bg-gray-800 rounded transition"
          title="Обновить"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      
      <div className="space-y-2">
        {algorithms.map((algo) => (
          <AlgorithmRow key={algo.name} algorithm={algo} />
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <span>Всего показано: {formatNumber(algorithms.reduce((sum, a) => sum + a.shown, 0))}</span>
        <span>Алгоритмов: {algorithms.length}</span>
      </div>
    </div>
  );
}
