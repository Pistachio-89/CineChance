import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint для очистки старых данных и управления жизненным циклом
 * POST /api/recommendations/data-lifecycle/cleanup
 */
export async function POST(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations');
  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }
  
  try {
    const body = await request.json();
    const { 
      table, 
      olderThanDays, 
      aggregateToStats = true,
      dryRun = false 
    } = body as {
      table: string;
      olderThanDays: number;
      aggregateToStats?: boolean;
      dryRun?: boolean;
    };

    // Валидация входных данных
    if (!table || !olderThanDays) {
      return NextResponse.json(
        { error: 'Missing required fields: table, olderThanDays' },
        { status: 400 }
      );
    }

    const validTables = [
      'RecommendationEvent',
      'IntentSignal', 
      'NegativeFeedback',
      'UserSession',
      'FilterSession',
      'RecommendationLog',
      'PredictionLog'
    ];

    if (!validTables.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table. Must be one of: ${validTables.join(', ')}` },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await cleanupTable(table, cutoffDate, aggregateToStats, dryRun);

    return NextResponse.json({
      success: true,
      ...result,
      message: dryRun 
        ? `DRY RUN: Would delete ${result.deletedCount} records from ${table}`
        : `Deleted ${result.deletedCount} records from ${table}`,
      cutoffDate: cutoffDate.toISOString(),
      olderThanDays,
    });

  } catch (error) {
    logger.error('Error in data cleanup', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'DataLifecycle'
    });
    return NextResponse.json(
      { error: 'Failed to cleanup data' },
      { status: 500 }
    );
  }
}

/**
 * Функция очистки таблицы
 */
async function cleanupTable(
  table: string, 
  cutoffDate: Date, 
  aggregateToStats: boolean,
  dryRun: boolean
): Promise<{ deletedCount: number; aggregatedCount: number }> {
  let deletedCount = 0;
  let aggregatedCount = 0;

  switch (table) {
    case 'RecommendationEvent':
      // RecommendationEvent использует поле `timestamp`, нет поля `processed`
      if (!dryRun) {
        const deleteResult = await prisma.recommendationEvent.deleteMany({
          where: {
            timestamp: { lt: cutoffDate },
          },
        });
        deletedCount = deleteResult.count;
      } else {
        const count = await prisma.recommendationEvent.count({
          where: { timestamp: { lt: cutoffDate } },
        });
        deletedCount = count;
      }
      break;

    case 'IntentSignal':
      // IntentSignal использует поле `createdAt`, нет поля `processed`
      if (!dryRun) {
        const deleteResult = await prisma.intentSignal.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
          },
        });
        deletedCount = deleteResult.count;
      } else {
        const count = await prisma.intentSignal.count({
          where: { createdAt: { lt: cutoffDate } },
        });
        deletedCount = count;
      }
      break;

    case 'NegativeFeedback':
      // Негативная обратная связь - важна для ML, агрегируем
      if (aggregateToStats && !dryRun) {
        // Агрегируем в статистику пользователя перед удалением
        await aggregateNegativeFeedback(cutoffDate);
        aggregatedCount = 1;
      }
      
      if (!dryRun) {
        const deleteResult = await prisma.negativeFeedback.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
        deletedCount = deleteResult.count;
      } else {
        deletedCount = await prisma.negativeFeedback.count({
          where: { createdAt: { lt: cutoffDate } },
        });
      }
      break;

    case 'UserSession':
      // Сессии - агрегируем метрики
      if (aggregateToStats && !dryRun) {
        await aggregateUserSessions(cutoffDate);
        aggregatedCount = 1;
      }
      
      if (!dryRun) {
        const deleteResult = await prisma.userSession.deleteMany({
          where: { startedAt: { lt: cutoffDate } },
        });
        deletedCount = deleteResult.count;
      } else {
        deletedCount = await prisma.userSession.count({
          where: { startedAt: { lt: cutoffDate } },
        });
      }
      break;

    case 'FilterSession':
      // FilterSession использует поле `startedAt`
      if (!dryRun) {
        const deleteResult = await prisma.filterSession.deleteMany({
          where: { startedAt: { lt: cutoffDate } },
        });
        deletedCount = deleteResult.count;
      } else {
        deletedCount = await prisma.filterSession.count({
          where: { startedAt: { lt: cutoffDate } },
        });
      }
      break;

    case 'RecommendationLog':
      // Логи рекомендаций - самые важные, дольше храним
      // Можно архивировать в отдельную таблицу
      if (!dryRun) {
        const deleteResult = await prisma.recommendationLog.deleteMany({
          where: { shownAt: { lt: cutoffDate } },
        });
        deletedCount = deleteResult.count;
      } else {
        deletedCount = await prisma.recommendationLog.count({
          where: { shownAt: { lt: cutoffDate } },
        });
      }
      break;

    case 'PredictionLog':
      // PredictionLog использует поле `computedAt`
      if (!dryRun) {
        const deleteResult = await prisma.predictionLog.deleteMany({
          where: { computedAt: { lt: cutoffDate } },
        });
        deletedCount = deleteResult.count;
      } else {
        deletedCount = await prisma.predictionLog.count({
          where: { computedAt: { lt: cutoffDate } },
        });
      }
      break;
  }

  return { deletedCount, aggregatedCount };
}

/**
 * Агрегация негативной обратной связи в статистику пользователя
 */
async function aggregateNegativeFeedback(cutoffDate: Date) {
  // Группируем по типам обратной связи
  const feedbackStats = await prisma.negativeFeedback.groupBy({
    by: ['feedbackType'],
    where: {
      createdAt: { lt: cutoffDate },
    },
    _count: true,
  });

  // Здесь можно обновить статистику пользователя
  // Пока просто логируем
  logger.info('Aggregated negative feedback stats', { stats: feedbackStats, context: 'DataLifecycle' });
}

/**
 * Агрегация метрик сессий
 */
async function aggregateUserSessions(cutoffDate: Date) {
  // Считаем общие метрики за период
  const sessionStats = await prisma.userSession.aggregate({
    _avg: {
      durationMs: true,
    },
    _sum: {
      durationMs: true,
    },
    where: {
      startedAt: { lt: cutoffDate },
    },
  });

  logger.info('Aggregated session stats', { stats: sessionStats, context: 'DataLifecycle' });
}

/**
 * GET /api/recommendations/data-lifecycle/status
 * Получение статистики размера данных
 */
export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations');
  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }
  
  try {
    const counts = await Promise.all([
      prisma.recommendationEvent.count(),
      prisma.intentSignal.count(),
      prisma.negativeFeedback.count(),
      prisma.userSession.count(),
      prisma.filterSession.count(),
      prisma.recommendationLog.count(),
      prisma.predictionLog.count(),
    ]);

    const tableNames = [
      'RecommendationEvent',
      'IntentSignal',
      'NegativeFeedback',
      'UserSession', 
      'FilterSession',
      'RecommendationLog',
      'PredictionLog',
    ];

    const stats = tableNames.map((name, index) => ({
      table: name,
      count: counts[index],
    }));

    // Рекомендуемые сроки хранения (с указанием поля даты)
    const retentionPolicy = {
      RecommendationEvent: { days: 90, description: 'События взаимодействия', dateField: 'timestamp' },
      IntentSignal: { days: 30, description: 'Сигналы намерений (быстро устаревают)', dateField: 'createdAt' },
      NegativeFeedback: { days: 180, description: 'Обратная связь (важно для ML)', dateField: 'createdAt' },
      UserSession: { days: 60, description: 'Сессии пользователей', dateField: 'startedAt' },
      FilterSession: { days: 60, description: 'Сессии фильтров', dateField: 'startedAt' },
      RecommendationLog: { days: 365, description: 'Логи рекомендаций', dateField: 'shownAt' },
      PredictionLog: { days: 90, description: 'Предсказания ML', dateField: 'computedAt' },
    };

    return NextResponse.json({
      success: true,
      currentCounts: stats,
      retentionPolicy,
      recommendations: {
        shouldCleanup: {
          IntentSignal: counts[1] > 100000, // >100k записей
          RecommendationEvent: counts[0] > 500000, // >500k записей
        },
        estimatedSpace: {
          eventsPerDay: Math.round(counts[0] / 30),
          signalsPerDay: Math.round(counts[1] / 30),
        }
      }
    });

  } catch (error) {
    logger.error('Error getting data lifecycle status', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'DataLifecycle'
    });
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
