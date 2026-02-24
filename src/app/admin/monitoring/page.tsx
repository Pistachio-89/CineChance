import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminSidebar from "../AdminSidebar";
import RecommendationStats from '@/app/components/RecommendationStats';
import MLDashboard from '@/app/components/MLDashboard';
import ActiveRecommendationsBlock from '@/app/components/ActiveRecommendationsBlock';
import { Clock, Brain } from 'lucide-react';
import LoaderSkeleton from "@/app/components/LoaderSkeleton";

function MLDashboardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
        <div className="h-6 w-32 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="h-4 w-20 bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MonitoringPage() {
  const session = await getServerSession(authOptions);

  // Проверка авторизации
  if (!session || !session.user) {
    redirect("/?auth=required");
  }

  // Проверка доступа только для определённого пользователя
  const ADMIN_USER_ID = 'cmkbc7sn2000104k3xd3zyf2a';
  if (session.user.id !== ADMIN_USER_ID) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Сайдбар админ-панели */}
      <AdminSidebar />

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Мониторинг системы</h1>
          <p className="text-gray-400">
            Статус работы рекомендательной системы и очистка данных
          </p>
        </div>

        <div className="space-y-6">
          {/* Компонент статистики */}
          <RecommendationStats />

          {/* ML Мониторинг - Общий заголовок */}
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">ML Мониторинг</h2>
          </div>

          {/* Блок активных рекомендаций */}
          <Suspense fallback={<MLDashboardSkeleton />}>
            <ActiveRecommendationsBlock />
          </Suspense>

          {/* Блок пассивных рекомендаций */}
          <Suspense fallback={<MLDashboardSkeleton />}>
            <MLDashboard />
          </Suspense>

          {/* Расписание очистки */}

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
      </main>
    </div>
  );
}
