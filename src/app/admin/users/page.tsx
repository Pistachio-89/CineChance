import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "../AdminSidebar";
import { Users, Calendar, Mail, Shield } from 'lucide-react';

export default async function UsersAdminPage() {
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

  // Загрузка всех пользователей
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      emailVerified: true,
      _count: {
        select: {
          watchList: true,
          recommendationLogs: true,
        },
      },
    },
  });

  // Статистика
  const totalUsers = users.length;
  const verifiedUsers = users.filter((u: { emailVerified: Date | null }) => u.emailVerified).length;
  const newUsers7Days = users.filter((u: { createdAt: Date }) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return u.createdAt > sevenDaysAgo;
  }).length;

  // Форматирование даты
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Сайдбар админ-панели */}
      <AdminSidebar />

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Пользователи</h1>
          <p className="text-gray-400">
            Управление пользователями платформы
          </p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Всего пользователей</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalUsers}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Подтверждённых</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{verifiedUsers}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">За 7 дней</span>
            </div>
            <p className="text-3xl font-bold text-purple-400">{newUsers7Days}</p>
          </div>
        </div>

        {/* Список пользователей */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Все пользователи</h2>

          {users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Пользователей пока нет</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                    <th className="pb-3 pr-4">Пользователь</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Дата регистрации</th>
                    <th className="pb-3 pr-4">Фильмов</th>
                    <th className="pb-3 pr-4">Рекомендаций</th>
                    <th className="pb-3">Статус</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {users.map((user: { id: string; name: string | null; email: string; createdAt: Date; emailVerified: Date | null; _count: { watchList: number; recommendationLogs: number } }) => (
                    <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {user.name || 'Без имени'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-4 h-4 text-gray-500" />
                          {user.email}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-gray-400">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-4 pr-4 text-gray-300">
                        {user._count.watchList}
                      </td>
                      <td className="py-4 pr-4 text-gray-300">
                        {user._count.recommendationLogs}
                      </td>
                      <td className="py-4">
                        {user.emailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                            <Shield className="w-3 h-3" />
                            Подтверждён
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                            Неподтверждён
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
