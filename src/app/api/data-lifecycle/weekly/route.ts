import { NextRequest, NextResponse } from 'next/server';

/**
 * Weekly cron endpoint for data lifecycle cleanup
 * Runs every Sunday at 3:00 AM UTC
 * Handles tables that need less frequent cleanup
 */

// Поля дат для разных таблиц
const DATE_FIELDS: Record<string, string> = {
  'IntentSignal': 'createdAt',
  'NegativeFeedback': 'createdAt',
};

// Сроки хранения (в днях)
const RETENTION_DAYS: Record<string, number> = {
  'IntentSignal': 30,     // Быстро устаревают - еженедельная очистка
  'NegativeFeedback': 180, // Важно для ML - еженедельная агрегация
};

export async function GET(request: NextRequest) {
  // 1. Проверка безопасности
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const results: Record<string, { deleted: number; aggregated: boolean; error?: string }> = {};
    const cutoffDate = new Date();

    // 2. Очищаем таблицы согласно политике хранения
    for (const [table, days] of Object.entries(RETENTION_DAYS)) {
      const dateField = DATE_FIELDS[table];
      
      const cutoff = new Date(cutoffDate);
      cutoff.setDate(cutoff.getDate() - days);

      try {
        // Агрегируем перед удалением для NegativeFeedback
        if (table === 'NegativeFeedback' && process.env.ENABLE_FEEDBACK_AGGREGATION === 'true') {
          await aggregateNegativeFeedback(cutoff);
          results[table] = { deleted: 0, aggregated: true };
        }

        const deleted = await deleteOldRecords(table, dateField, cutoff);
        results[table] = { deleted, aggregated: false };
        console.log(`Weekly cleanup: ${deleted} records from ${table} (older than ${days} days)`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results[table] = { deleted: 0, aggregated: false, error: errorMessage };
        console.error(`Error cleaning ${table}:`, error);
      }
    }

    // 3. Возвращаем результат
    return NextResponse.json({
      success: true,
      type: 'weekly',
      executedAt: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      retentionPolicy: RETENTION_DAYS,
      results,
    });

  } catch (error) {
    console.error('Weekly cron cleanup failed:', error);
    return NextResponse.json(
      { success: false, error: 'Weekly cleanup failed' },
      { status: 500 }
    );
  }
}

async function aggregateNegativeFeedback(cutoffDate: Date) {
  const { prisma } = await import('@/lib/prisma');
  
  // Группируем обратную связь по типам для аналитики
  const feedbackStats = await prisma.negativeFeedback.groupBy({
    by: ['feedbackType'],
    where: {
      createdAt: { lt: cutoffDate },
    },
    _count: true,
  });

  // Здесь можно сохранить агрегированные данные в отдельную таблицу
  // или обновить статистику пользователя
  console.log('Aggregated negative feedback stats:', feedbackStats);
  
  return feedbackStats;
}

async function deleteOldRecords(table: string, dateField: string, cutoffDate: Date): Promise<number> {
  const { prisma } = await import('@/lib/prisma');
  
  const whereClause: Record<string, unknown> = {};
  whereClause[dateField] = { lt: cutoffDate };

  switch (table) {
    case 'IntentSignal':
      return (await prisma.intentSignal.deleteMany({ where: whereClause })).count;
    case 'NegativeFeedback':
      return (await prisma.negativeFeedback.deleteMany({ where: whereClause })).count;
    default:
      return 0;
  }
}
