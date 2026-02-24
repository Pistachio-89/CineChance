'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Brain,
  Eye
} from 'lucide-react';

interface ActiveStatsData {
  success: boolean;
  overview: {
    totalGenerated: number;
    totalShown: number;
    totalDropped: number;
    totalHidden: number;
    uniqueUsers: number;
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
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

interface ActiveRecommendationsBlockProps {
  onRefresh?: () => void;
}

export default function ActiveRecommendationsBlock({ onRefresh }: ActiveRecommendationsBlockProps) {
  const [stats, setStats] = useState<ActiveStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/recommendations/ml-stats-active');
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
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <h3 className="text-lg font-semibold text-white">Активные рекомендации</h3>
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
          <h3 className="text-lg font-semibold text-white">Активные рекомендации</h3>
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

  const isOk = stats.success && stats.overview.totalGenerated > 0;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Заголовок блока */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Активные рекомендации</h3>
          <button
            onClick={() => {
              fetchStats();
              onRefresh?.();
            }}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>
        {isOk ? (
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

      {/* Метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Сгенерировано"
          value={formatNumber(stats.overview.totalGenerated)}
          subtitle="всего"
          icon={Brain}
          color="bg-blue-400/10 text-blue-400"
        />
        <StatCard
          title="Показано"
          value={formatNumber(stats.overview.totalShown)}
          subtitle={`${stats.overview.uniqueUsers} польз.`}
          icon={Eye}
          color="bg-purple-400/10 text-purple-400"
        />
      </div>
    </div>
  );
}
