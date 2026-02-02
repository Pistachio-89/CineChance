import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "./AdminSidebar";
import Link from "next/link";

export default async function AdminDashboardPage() {
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

  // Загрузка статистики
  const [totalUsers, totalInvitations, pendingInvitations, usedInvitations] = await Promise.all([
    prisma.user.count(),
    prisma.invitation.count(),
    prisma.invitation.count({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.invitation.count({
      where: {
        usedAt: { not: null },
      },
    }),
  ]);

  // Последние приглашения
  const recentInvitations = await prisma.invitation.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      usedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Статистика регистраций по дням (последние 7 дней)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const newUsers = await prisma.user.count({
    where: {
      createdAt: { gte: sevenDaysAgo },
    },
  });

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Сайдбар админ-панели */}
      <AdminSidebar />

      {/* Основной контент */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Приветствие */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Добро пожаловать, {session.user.name || session.user.email}!
          </h1>
          <p className="text-gray-400">
            Панель управления платформой CineChance
          </p>
        </div>

        {/* Карточки статистики */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Всего пользователей</p>
            <p className="text-3xl font-bold text-white">{totalUsers}</p>
            <p className="text-green-400 text-sm mt-2">+{newUsers} за неделю</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Всего приглашений</p>
            <p className="text-3xl font-bold text-white">{totalInvitations}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Использовано</p>
            <p className="text-3xl font-bold text-green-400">{usedInvitations}</p>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm">Ожидают</p>
            <p className="text-3xl font-bold text-yellow-400">{pendingInvitations}</p>
          </div>
        </div>

        {/* Раздел управления */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Быстрые действия */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Быстрые действия</h2>
            <div className="space-y-3">
              <Link
                href="/admin/invitations"
                className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition group"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Создать приглашение</p>
                  <p className="text-gray-400 text-sm">Отправить приглашение на email</p>
                </div>
              </Link>

              <Link
                href="/admin/invitations"
                className="flex items-center gap-4 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition group"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Управление приглашениями</p>
                  <p className="text-gray-400 text-sm">Просмотр и удаление приглашений</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Последние приглашения */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Последние приглашения</h2>
              <Link href="/admin/invitations" className="text-purple-400 hover:text-purple-300 text-sm">
                Смотреть все →
              </Link>
            </div>

            {recentInvitations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>Приглашений пока нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvitations.map((invitation: { id: string; email: string; createdAt: Date; usedAt: Date | null; expiresAt: Date }) => (
                  <div key={invitation.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">{invitation.email}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(invitation.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    {invitation.usedAt ? (
                      <span className="text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded-full">
                        Использовано
                      </span>
                    ) : invitation.expiresAt < new Date() ? (
                      <span className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded-full">
                        Истёк
                      </span>
                    ) : (
                      <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-1 rounded-full">
                        Ожидает
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
