// src/app/movie-history/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{
    tmdbId?: string;
    mediaType?: string;
  }>;
}

export default async function MovieHistoryPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/api/auth/signin');
  }

  const { tmdbId, mediaType } = await searchParams;
  
  if (!tmdbId || !mediaType) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white p-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/my-movies" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-4">
            ← Вернуться к фильмам
          </Link>
          <h1 className="text-2xl font-bold">Не указан фильм</h1>
          <p className="text-gray-400 mt-2">Перейдите на эту страницу из карточки фильма</p>
        </div>
      </div>
    );
  }

  const tmdbIdNum = parseInt(tmdbId);

  // Получаем данные о фильме
  const watchList = await prisma.watchList.findUnique({
    where: {
      userId_tmdbId_mediaType: {
        userId: session.user.id,
        tmdbId: tmdbIdNum,
        mediaType,
      },
    },
    select: {
      id: true,
      tmdbId: true,
      mediaType: true,
      title: true,
      voteAverage: true,
      userRating: true,
      weightedRating: true,
      statusId: true,
      addedAt: true,
      watchedDate: true,
      note: true,
      watchCount: true,
      status: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!watchList) {
    return (
      <div className="min-h-screen bg-[#0a0e17] text-white p-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/my-movies" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-4">
            ← Вернуться к фильмам
          </Link>
          <h1 className="text-2xl font-bold">Фильм не найден</h1>
        </div>
      </div>
    );
  }

  // Получаем историю изменений статусов из логов системы
  // Используем audit trail или создаем историю из доступных данных
  const statusHistory = await prisma.$queryRaw`
    WITH status_changes AS (
      SELECT 
        ws.id,
        ws.statusId,
        ws.addedAt,
        ms.name as statusName,
        ROW_NUMBER() OVER (ORDER BY ws.addedAt DESC) as rn
      FROM "WatchList" ws
      JOIN "MovieStatus" ms ON ws.statusId = ms.id
      WHERE ws.userId = ${session.user.id}
        AND ws.tmdbId = ${tmdbIdNum}
        AND ws.mediaType = ${mediaType}
    )
    SELECT * FROM status_changes ORDER BY addedAt DESC
  `;

  // Получаем логи пересмотров
  const rewatchLogs = await prisma.rewatchLog.findMany({
    where: {
      userId: session.user.id,
      tmdbId: tmdbIdNum,
      mediaType,
    },
    orderBy: {
      watchedAt: 'desc',
    },
  });

  // Получаем историю изменений оценок с датами просмотра
  const ratingHistory = await prisma.ratingHistory.findMany({
    where: {
      userId: session.user.id,
      tmdbId: tmdbIdNum,
      mediaType,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Обогащаем историю оценок датами просмотра из WatchList
  const enrichedRatingHistory = ratingHistory.map(entry => ({
    ...entry,
    // Для первоначальной оценки используем watchedDate из WatchList
    // Для изменений оценок используем createdAt (когда изменили)
    displayDate: entry.actionType === 'initial' 
      ? (watchList.watchedDate || entry.createdAt)
      : entry.createdAt
  }));

  // Форматируем дату
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Заголовок с навигацией */}
        <Link href="/my-movies" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-6">
          ← Вернуться к фильмам
        </Link>

        <div className="bg-[#0f1520] rounded-xl p-6 border border-blue-500/20 mb-6">
          <h1 className="text-xl font-bold">{watchList.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span>Статус: {watchList.status?.name}</span>
            <span>•</span>
            <span>Просмотров: {watchList.watchCount}</span>
            {watchList.weightedRating && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-green-400">Текущая: {watchList.weightedRating.toFixed(1)}</span>
                  {watchList.userRating && watchList.weightedRating !== watchList.userRating && (
                    <span className={`flex items-center gap-1 text-xs ${
                      watchList.weightedRating > watchList.userRating ? 'text-green-400' : 
                      watchList.weightedRating < watchList.userRating ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {watchList.weightedRating > watchList.userRating && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                          <polyline points="17 6 23 6 23 12"></polyline>
                        </svg>
                      )}
                      {watchList.weightedRating < watchList.userRating && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                          <polyline points="17 18 23 18 23 12"></polyline>
                        </svg>
                      )}
                      {watchList.weightedRating === watchList.userRating && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      )}
                      {(watchList.weightedRating - watchList.userRating).toFixed(1)}
                    </span>
                  )}
                </div>
              </>
            )}
            {watchList.userRating && (
              <>
                <span>•</span>
                <span className="text-purple-400">Последняя: {watchList.userRating}</span>
              </>
            )}
          </div>
        </div>

        {/* История изменений статусов */}
        <div className="bg-[#0f1520] rounded-xl p-6 border border-blue-500/20 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
              <path d="M2 17L12 22L22 17"></path>
              <path d="M2 12L12 17L22 12"></path>
            </svg>
            История изменений статусов
          </h2>

          {statusHistory.length === 0 ? (
            <p className="text-gray-500 text-sm">Фильм не добавлен в списки</p>
          ) : (
            <div className="space-y-3">
              {statusHistory.map((entry: any, index: number) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-300">
                      Статус: {entry.statusName || 'Неизвестный статус'}
                    </span>
                    <span className="text-gray-500 ml-2">{formatDate(entry.addedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Логи пересмотров */}
        <div className="bg-[#0f1520] rounded-xl p-6 border border-blue-500/20 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <path d="M17 1l4 4-4 4"></path>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <path d="M7 23l-4-4 4-4"></path>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            История пересмотров
          </h2>

          {rewatchLogs.length === 0 ? (
            <p className="text-gray-500 text-sm">Пересмотров пока нет</p>
          ) : (
            <div className="space-y-3">
              {rewatchLogs.map((log, index) => (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-300">Пересмотр #{rewatchLogs.length - index}</span>
                    <span className="text-gray-500 ml-2">{formatDate(log.watchedAt)}</span>
                    {log.previousWatchCount !== undefined && (
                      <span className="text-gray-400 ml-2">(было {log.previousWatchCount} просмотров)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* История изменений оценок */}
        <div className="bg-[#0f1520] rounded-xl p-6 border border-blue-500/20">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            История изменений оценок
            {watchList.weightedRating && (
              <span className="text-sm text-green-400 ml-2">
                (текущая взвешенная: {watchList.weightedRating.toFixed(1)})
              </span>
            )}
          </h2>

          {ratingHistory.length === 0 ? (
            <p className="text-gray-500 text-sm">Изменений оценок пока нет</p>
          ) : (
            <div className="space-y-3">
              {enrichedRatingHistory.map((entry: any, index: number) => {
                return (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-xs font-bold">
                      {entry.rating}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">
                          Оценка: {entry.rating}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {entry.actionType === 'rewatch' && <span className="text-purple-400 ml-1">(при пересмотре)</span>}
                          {entry.actionType === 'rating_change' && <span className="text-blue-400 ml-1">(изменение)</span>}
                          {entry.actionType === 'initial' && <span className="text-green-400 ml-1">(первоначальная)</span>}
                        </span>
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {formatDate(entry.displayDate)}
                        {entry.previousRating && (
                          <span className="ml-2">(было {entry.previousRating})</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
