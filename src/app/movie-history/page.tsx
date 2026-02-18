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

  // Функция расчета взвешенной оценки согласно плану
  const calculateWeightedRating = (ratingHistory: any[], watchCount: number) => {
    if (!ratingHistory.length) return null;
    
    // Сортируем по дате (старые сначала)
    const sortedHistory = [...ratingHistory].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    let weightedSum = 0;
    let weightSum = 0;
    let rewatchCounter = 0;
    
    sortedHistory.forEach((entry, index) => {
      let weight = 1.0;
      
      if (entry.actionType === 'initial') {
        weight = 1.0; // Первый просмотр
      } else if (entry.actionType === 'rating_change') {
        weight = 0.9; // Изменение оценки
      } else if (entry.actionType === 'rewatch') {
        rewatchCounter++;
        weight = Math.max(0.4, 1.0 - (rewatchCounter * 0.2)); // 0.8, 0.6, 0.4...
      }
      
      weightedSum += entry.rating * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : null;
  };

  // Рассчитываем взвешенную оценку если ее нет
  const calculatedWeightedRating = watchList.weightedRating || 
    calculateWeightedRating(ratingHistory, watchList.watchCount);

  // Обогащаем историю оценок датами просмотра из WatchList
  // Используем watchedDate из WatchList для всех записей, так как это дата из датапикера
  const enrichedRatingHistory = ratingHistory.map(entry => ({
    ...entry,
    // Всегда используем watchedDate из WatchList - это дата из датапикера
    displayDate: watchList.watchedDate || entry.createdAt
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
          <h1 className="text-xl font-bold mb-4 text-white">{watchList.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-bold text-white">
              Текущий статус: 
              <span className={
                watchList.status?.name === 'Просмотрено' ? 'text-green-400' :
                watchList.status?.name === 'Хочу посмотреть' ? 'text-blue-400' :
                watchList.status?.name === 'Брошено' ? 'text-red-400' :
                watchList.status?.name === 'Пересмотрено' ? 'text-purple-400' :
                'text-gray-400'
              }>
                {' '}{watchList.status?.name || 'Неизвестный статус'}
              </span>
            </span>
            
            <span className="text-gray-300">
              Количество повторных просмотров: <span className="font-bold text-purple-400">{watchList.watchCount}</span>
            </span>
            
            {calculatedWeightedRating && (
              <span className="text-gray-300">
                Взвешенная оценка: <span className="font-bold text-green-400">{calculatedWeightedRating.toFixed(1)}</span>
              </span>
            )}
            
            {!calculatedWeightedRating && watchList.userRating && (
              <span className="text-gray-300">
                Оценка: <span className="font-bold text-yellow-400">{watchList.userRating}</span>
              </span>
            )}
          </div>
        </div>

        {/* История изменений статусов - ВРЕМЕННО УБРАНО */}
        {/* 
        Примечание: Текущая структура БД (WatchList) хранит только текущий статус фильма,
        не ведет историю изменений статусов. Для отображения полной истории статусов
        потребуется модификация схемы БД с добавлением таблицы StatusHistory.
        
        Текущий SQL запрос возвращает только одну запись (текущий статус).
        */}

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
