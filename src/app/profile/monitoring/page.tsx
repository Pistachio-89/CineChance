// src/app/profile/monitoring/page.tsx
import RecommendationStats from '@/app/components/RecommendationStats';
import { Activity, Database, Clock } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Мониторинг системы</h2>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Статус работы рекомендательной системы и очистка данных
        </p>
      </div>

      {/* Компонент статистики */}
      <RecommendationStats />

      {/* Информация о системе */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Политика хранения данных</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">События рекомендаций</p>
            <p className="text-gray-500 text-sm">90 дней</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">Сигналы намерений</p>
            <p className="text-gray-500 text-sm">30 дней</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">Сессии пользователей</p>
            <p className="text-gray-500 text-sm">60 дней</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">Негативная обратная связь</p>
            <p className="text-gray-500 text-sm">180 дней</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">Логи рекомендаций</p>
            <p className="text-gray-500 text-sm">365 дней</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 text-xs mb-2">Тип данных</p>
            <p className="text-white font-medium">ML предсказания</p>
            <p className="text-gray-500 text-sm">90 дней</p>
          </div>
        </div>
      </div>

      {/* Расписание очистки */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Расписание очистки</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Ежедневная очистка</p>
              <p className="text-gray-500 text-sm">4:00 UTC</p>
            </div>
            <span className="px-3 py-1 bg-green-400/10 text-green-400 rounded-full text-xs border border-green-400/30">
              Активна
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">Еженедельная очистка</p>
              <p className="text-gray-500 text-sm">Воскресенье, 3:00 UTC</p>
            </div>
            <span className="px-3 py-1 bg-green-400/10 text-green-400 rounded-full text-xs border border-green-400/30">
              Активна
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
