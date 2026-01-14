import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Cron endpoint for daily data lifecycle cleanup
 * Runs at 4:00 AM UTC daily
 * 
 * Vercel automatically adds CRON_SECRET header to cron requests
 * This endpoint acts as a proxy to the main cleanup API with proper authentication
 */

// Поля дат для разных таблиц
const DATE_FIELDS: Record<string, string> = {
  'RecommendationEvent': 'timestamp',
  'IntentSignal': 'createdAt',
  'NegativeFeedback': 'createdAt',
  'UserSession': 'startedAt',
  'FilterSession': 'startedAt',
  'RecommendationLog': 'shownAt',
  'PredictionLog': 'computedAt',
};

// Сроки хранения (в днях)
const RETENTION_DAYS: Record<string, number> = {
  'IntentSignal': 30,          // Быстро устаревают
  'RecommendationEvent': 90,   // События
  'PredictionLog': 90,         // ML предсказания
  'UserSession': 60,           // Сессии
  'FilterSession': 60,         // Сессии фильтров
  'NegativeFeedback': 180,     // Обратная связь (важно для ML)
  'RecommendationLog': 365,    // Логи рекомендаций
};

export async function GET(request: NextRequest) {
  // 1. Проверка безопасности - Vercel добавляет CRON_SECRET автоматически
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn('Unauthorized cron access attempt', { context: 'Cron' });
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const results: Record<string, { deleted: number; error?: string }> = {};
    const cutoffDate = new Date();

    // 2. Очищаем каждую таблицу согласно политике хранения
    for (const [table, days] of Object.entries(RETENTION_DAYS)) {
      const dateField = DATE_FIELDS[table];
      
      const cutoff = new Date(cutoffDate);
      cutoff.setDate(cutoff.getDate() - days);

      try {
        const deleted = await deleteOldRecords(table, dateField, cutoff);
        results[table] = { deleted };
        logger.info('Daily cleanup completed', { table, deleted, days, context: 'Cron' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results[table] = { deleted: 0, error: errorMessage };
        logger.error('Error cleaning table', { table, error: errorMessage, context: 'Cron' });
      }
    }

    // 3. Возвращаем результат
    return NextResponse.json({
      success: true,
      executedAt: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      retentionPolicy: RETENTION_DAYS,
      results,
    });

  } catch (error) {
    logger.error('Cron cleanup failed', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Cron'
    });
    return NextResponse.json(
      { success: false, error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

async function deleteOldRecords(table: string, dateField: string, cutoffDate: Date): Promise<number> {
  const { prisma } = await import('@/lib/prisma');
  
  // Используем Prisma с динамическим полем даты
  const whereClause: Record<string, unknown> = {};
  whereClause[dateField] = { lt: cutoffDate };

  switch (table) {
    case 'RecommendationEvent':
      return (await prisma.recommendationEvent.deleteMany({ where: whereClause })).count;
    case 'IntentSignal':
      return (await prisma.intentSignal.deleteMany({ where: whereClause })).count;
    case 'NegativeFeedback':
      return (await prisma.negativeFeedback.deleteMany({ where: whereClause })).count;
    case 'UserSession':
      return (await prisma.userSession.deleteMany({ where: whereClause })).count;
    case 'FilterSession':
      return (await prisma.filterSession.deleteMany({ where: whereClause })).count;
    case 'RecommendationLog':
      return (await prisma.recommendationLog.deleteMany({ where: whereClause })).count;
    case 'PredictionLog':
      return (await prisma.predictionLog.deleteMany({ where: whereClause })).count;
    default:
      return 0;
  }
}
