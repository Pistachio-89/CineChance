// src/app/profile/page.tsx - Overview page
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/');
  }

  const userId = session.user.id;
  const userName = session.user.name || 'Пользователь';
  const userEmail = session.user.email || '';
  const userInitial = session.user.name?.charAt(0) || session.user.email?.charAt(0).toUpperCase() || 'U';

  // Получаем данные пользователя, включая дату рождения
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true },
  });

  // Форматируем дату рождения
  const formattedBirthDate = user?.birthDate 
    ? format(user.birthDate, 'dd.MM.yyyy')
    : null;

  // Получаем статистику пользователя
  const watchListCount = await prisma.watchList.count({
    where: { userId },
  });

  const blacklistCount = await prisma.blacklist.count({
    where: { userId },
  });

  return (
    <div className="space-y-6">
      {/* Информация о пользователе */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Информация</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {userInitial}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              {userName}
            </h3>
            <p className="text-gray-400">{userEmail}</p>
            <p className="text-gray-500 text-sm mt-1">
              Дата рождения: <span className="text-gray-300">{formattedBirthDate || '-'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-gray-400 text-sm mb-1">Фильмов в списке</p>
          <p className="text-3xl font-bold text-white">{watchListCount}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-gray-400 text-sm mb-1">Скрыто фильмов</p>
          <p className="text-3xl font-bold text-white">{blacklistCount}</p>
        </div>
      </div>

      {/* Быстрые ссылки */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Быстрый доступ</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link 
            href="/my-movies"
            className="p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition text-center"
          >
            <p className="text-white font-medium">Мои фильмы</p>
            <p className="text-gray-500 text-sm">Управление списком</p>
          </Link>
          <Link 
            href="/profile/settings"
            className="p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition text-center"
          >
            <p className="text-white font-medium">Настройки</p>
            <p className="text-gray-500 text-sm">Параметры аккаунта</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
