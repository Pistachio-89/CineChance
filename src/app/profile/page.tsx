// src/app/profile/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  // Получаем статистику пользователя
  const watchListCount = await prisma.watchList.count({
    where: { userId: session.user.id },
  });

  const blacklistCount = await prisma.blacklist.count({
    where: { userId: session.user.id },
  });

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-8">
          Профиль
        </h1>

        {/* Информация о пользователе */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {session.user.name?.charAt(0) || session.user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {session.user.name || 'Пользователь'}
              </h2>
              <p className="text-gray-400">
                {session.user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">Фильмов в списке</p>
            <p className="text-3xl font-bold text-white">{watchListCount}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm mb-1">Скрыто фильмов</p>
            <p className="text-3xl font-bold text-white">{blacklistCount}</p>
          </div>
        </div>

        {/* Заглушка настроек */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">
            Настройки
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">
                Страница настроек находится в разработке...
              </p>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <div className="mt-8">
          <Link 
            href="/my-movies"
            className="text-blue-400 hover:text-blue-300 transition"
          >
            ← Вернуться к моим фильмам
          </Link>
        </div>
      </div>
    </div>
  );
}
