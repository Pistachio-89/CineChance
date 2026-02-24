import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint for recommendation system statistics
 * Returns record counts, date ranges, and cleanup status
 */

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations/stats');
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too Many Requests' },
      { status: 429 }
    );
  }
  
  try {
    const { prisma } = await import('@/lib/prisma');

    // Проверка авторизации (опционально - можно открыть для всех)
    // const session = await getServerSession(authOptions);
    // if (!session) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    // Получаем статистику по всем таблицам
    const [
      eventStats,
      signalStats,
      feedbackStats,
      sessionStats,
      filterSessionStats,
      recommendationLogStats,
      predictionLogStats,
    ] = await Promise.all([
      getTableStats(prisma.recommendationEvent, 'timestamp'),
      getTableStats(prisma.intentSignal, 'createdAt'),
      getTableStats(prisma.negativeFeedback, 'createdAt'),
      getTableStats(prisma.userSession, 'startedAt'),
      getTableStats(prisma.filterSession, 'startedAt'),
      getTableStats(prisma.recommendationLog, 'shownAt'),
      getTableStats(prisma.predictionLog, 'computedAt'),
    ]);

    // Политика хранения
    const retentionPolicy = {
      'RecommendationEvent': 90,
      'IntentSignal': 30,
      'NegativeFeedback': 180,
      'UserSession': 60,
      'FilterSession': 60,
      'RecommendationLog': 365,
      'PredictionLog': 90,
    };

    // Проверяем статус очистки
    const cleanupStatus = calculateCleanupStatus({
      eventStats,
      signalStats,
      feedbackStats,
      sessionStats,
      filterSessionStats,
      recommendationLogStats,
      predictionLogStats,
    }, retentionPolicy);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tables: {
        RecommendationEvent: eventStats,
        IntentSignal: signalStats,
        NegativeFeedback: feedbackStats,
        UserSession: sessionStats,
        FilterSession: filterSessionStats,
        RecommendationLog: recommendationLogStats,
        PredictionLog: predictionLogStats,
      },
      retentionPolicy,
      cleanupStatus,
    });

  } catch (error) {
    logger.error('Stats error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

async function getTableStats(
  model: any,
  dateField: string
) {
  const total = await model.count();
  
  const oldest = await model.findFirst({
    orderBy: { [dateField]: 'asc' as const },
  }) as { [key: string]: string } | null;
  
  const newest = await model.findFirst({
    orderBy: { [dateField]: 'desc' as const },
  }) as { [key: string]: string } | null;

  return {
    total,
    oldestDate: oldest?.[dateField] || null,
    newestDate: newest?.[dateField] || null,
  };
}

function calculateCleanupStatus(
  stats: Record<string, { oldestDate: string | null; newestDate: string | null; total: number }>,
  retentionPolicy: Record<string, number>
): { healthy: boolean; message: string; details: Record<string, { status: 'ok' | 'warning' | 'critical'; message: string }> } {
  const details: Record<string, { status: 'ok' | 'warning' | 'critical'; message: string }> = {};
  let allHealthy = true;

  const now = new Date();

  for (const [table, data] of Object.entries(stats)) {
    if (!data.oldestDate) {
      details[table] = { status: 'ok', message: 'Таблица пуста' };
      continue;
    }

    const retentionDays = retentionPolicy[table] || 90;
    const oldestDate = new Date(data.oldestDate);
    const daysOld = (now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);

    // Проверяем, есть ли записи старше политики хранения
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const hasOverdueRecords = oldestDate < cutoffDate;

    if (hasOverdueRecords) {
      if (daysOld > retentionDays * 1.5) {
        details[table] = { 
          status: 'critical', 
          message: `Записи старше ${Math.round(daysOld)} дней (лимит: ${retentionDays})` 
        };
        allHealthy = false;
      } else {
        details[table] = { 
          status: 'warning', 
          message: `Есть записи старше ${retentionDays} дней` 
        };
      }
    } else {
      details[table] = { 
        status: 'ok', 
        message: `Все записи в рамках политики (${retentionDays} дней)` 
      };
    }
  }

  return {
    healthy: allHealthy,
    message: allHealthy ? 'Очистка работает корректно' : 'Обнаружены проблемы с очисткой данных',
    details,
  };
}
