import { NextRequest, NextResponse } from 'next/server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS, getStatusIdByName, getStatusNameById } from '@/lib/movieStatusConstants';
import { logger } from '@/lib/logger';

interface LogsData {
  timestamp: string;
  userId: string;
  section: string;
  constants: {
    MOVIE_STATUS_IDS: typeof MOVIE_STATUS_IDS;
    MOVIE_STATUS_NAMES: Record<number, string>;
  };
  statusTests: Record<string, number | null>;
  databaseChecks: {
    individualCounts: Record<string, number>;
    combinedCounts: Record<string, number>;
    sampleRecords: any;
  };
  apiComparison: any;
  sampleRecords: any;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Собираем всю информацию для логов
    const logs: LogsData = {
      timestamp: new Date().toISOString(),
      userId,
      section: '=== ПОЛНАЯ ДИАГНОСТИКА СТАТИСТИКИ ===',
      constants: {
        MOVIE_STATUS_IDS,
        MOVIE_STATUS_NAMES: {
          [MOVIE_STATUS_IDS.WANT_TO_WATCH]: 'Хочу посмотреть',
          [MOVIE_STATUS_IDS.WATCHED]: 'Просмотрено',
          [MOVIE_STATUS_IDS.REWATCHED]: 'Пересмотрено',
          [MOVIE_STATUS_IDS.DROPPED]: 'Брошено',
        }
      },
      statusTests: {
        'Брошено': getStatusIdByName('Брошено'),
        'Хочу посмотреть': getStatusIdByName('Хочу посмотреть'),
        'Просмотрено': getStatusIdByName('Просмотрено'),
        'Пересмотрено': getStatusIdByName('Пересмотрено'),
      },
      databaseChecks: {
        individualCounts: {} as Record<string, number>,
        combinedCounts: {} as Record<string, number>,
        sampleRecords: [] as unknown[]
      },
      apiComparison: {} as Record<string, unknown>,
      sampleRecords: [] as unknown[]
    };

    // Подробная проверка базы данных
    logs.databaseChecks = {
      individualCounts: {},
      combinedCounts: {},
      sampleRecords: []
    };

    // Считаем по каждому статусу индивидуально
    const individualCounts = await Promise.all([
      prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH } }),
      prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.WATCHED } }),
      prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.REWATCHED } }),
      prisma.watchList.count({ where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED } }),
      prisma.blacklist.count({ where: { userId } }),
    ]);

    logs.databaseChecks.individualCounts = {
      'WANT_TO_WATCH (1)': individualCounts[0],
      'WATCHED (2)': individualCounts[1],
      'REWATCHED (3)': individualCounts[2],
      'DROPPED (4)': individualCounts[3],
      'BLACKLIST': individualCounts[4],
    };

    // Считаем комбинированные запросы (как в API)
    const combinedCounts = await Promise.all([
      // WATCHED + REWATCHED (как в /api/user/stats)
      prisma.watchList.count({
        where: {
          userId,
          statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
        },
      }),
      // WANT_TO_WATCH
      prisma.watchList.count({
        where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH },
      }),
      // DROPPED
      prisma.watchList.count({
        where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED },
      }),
    ]);

    logs.databaseChecks.combinedCounts = {
      'WATCHED + REWATCHED': combinedCounts[0],
      'WANT_TO_WATCH': combinedCounts[1],
      'DROPPED': combinedCounts[2],
      'HIDDEN (blacklist)': individualCounts[4],
    };

    // Получаем образцы записей для каждого статуса
    const sampleRecords = await Promise.all([
      prisma.watchList.findMany({
        where: { userId, statusId: MOVIE_STATUS_IDS.WATCHED },
        select: { id: true, tmdbId: true, mediaType: true, title: true, statusId: true },
        take: 2,
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }]
      }),
      prisma.watchList.findMany({
        where: { userId, statusId: MOVIE_STATUS_IDS.REWATCHED },
        select: { id: true, tmdbId: true, mediaType: true, title: true, statusId: true },
        take: 2,
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }]
      }),
      prisma.watchList.findMany({
        where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH },
        select: { id: true, tmdbId: true, mediaType: true, title: true, statusId: true },
        take: 2,
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }]
      }),
      prisma.watchList.findMany({
        where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED },
        select: { id: true, tmdbId: true, mediaType: true, title: true, statusId: true },
        take: 2,
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }]
      }),
    ]);

    logs.databaseChecks.sampleRecords = {
      'WATCHED': sampleRecords[0].map(r => ({ ...r, statusName: getStatusNameById(r.statusId) })),
      'REWATCHED': sampleRecords[1].map(r => ({ ...r, statusName: getStatusNameById(r.statusId) })),
      'WANT_TO_WATCH': sampleRecords[2].map(r => ({ ...r, statusName: getStatusNameById(r.statusId) })),
      'DROPPED': sampleRecords[3].map(r => ({ ...r, statusName: getStatusNameById(r.statusId) })),
    };

    // Сравнение с результатами API
    try {
      // Имитируем запрос к /api/user/stats
      const userStatsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user/stats`, {
        headers: { cookie: request.headers.get('cookie') || '' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (userStatsResponse.ok) {
        const userStats = await userStatsResponse.json();
        logs.apiComparison.userStats = {
          watched: userStats.total?.watched || 0,
          wantToWatch: userStats.total?.wantToWatch || 0,
          dropped: userStats.total?.dropped || 0,
          hidden: userStats.total?.hidden || 0,
          debug: userStats.debug
        };
      }
    } catch (error) {
      logs.apiComparison.userStatsError = error instanceof Error ? error.message : String(error);
    }

    try {
      // Имитируем запрос к /api/debug/stats
      const debugStatsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/debug/stats`, {
        headers: { cookie: request.headers.get('cookie') || '' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (debugStatsResponse.ok) {
        const debugStats = await debugStatsResponse.json();
        logs.apiComparison.debugStats = {
          databaseCounts: debugStats.databaseCounts,
          typeAnalysis: debugStats.typeAnalysis
        };
      }
    } catch (error) {
      logs.apiComparison.debugStatsError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json(logs);

  } catch (error: any) {
    logger.error('Logs endpoint error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: error.message }, 
      { status: 500 }
    );
  }
}
