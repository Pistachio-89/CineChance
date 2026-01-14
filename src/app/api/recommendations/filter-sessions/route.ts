import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FilterChange, FilterSessionResultMetrics, AbandonedFilter } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint для управления сессиями фильтров
 * POST /api/recommendations/filter-sessions
 * 
 * FilterSession отслеживает изменения фильтров пользователем в рамках одной сессии
 * и связывает их с результатами рекомендаций.
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

    // Валидация входных данных
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      userId,
      sessionId,
      initialState,
      changesHistory,
      resultMetrics,
      abandonedFilters,
      outcome,
      durationMs
    } = body as {
      userId: string;
      sessionId: string;
      initialState?: Record<string, unknown>;
      changesHistory?: FilterChange[];
      resultMetrics?: FilterSessionResultMetrics;
      abandonedFilters?: AbandonedFilter[];
      outcome?: string;
      durationMs?: number;
    };

    // Обязательные поля
    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, sessionId' },
        { status: 400 }
      );
    }

    // Валидация исхода сессии
    const validOutcomes = ['success', 'partial', 'abandoned', 'error'];
    if (outcome && !validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}}` },
        { status: 400 }
      );
    }

    // Проверяем, существует ли UserSession
    const userSessionExists = await prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { id: true }
    });

    if (!userSessionExists) {
      return NextResponse.json(
        { error: 'UserSession not found' },
        { status: 404 }
      );
    }

    // Создание записи сессии фильтров
    const filterSession = await prisma.filterSession.create({
      data: {
        userId,
        sessionId,
        initialState: initialState as any,
        changesHistory: changesHistory as any,
        resultMetrics: resultMetrics as any,
        abandonedFilters: abandonedFilters as any,
        status: outcome ? 'completed' : 'active',
        completedAt: outcome ? new Date() : undefined,
        durationMs,
      },
    });

    // Обновляем связь в UserSession
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        filterSessions: { connect: { id: filterSession.id } }
      }
    });

    return NextResponse.json(
      {
        success: true,
        filterSessionId: filterSession.id,
        message: 'Filter session recorded successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error recording filter session', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for filter session' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to record filter session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/filter-sessions
 * Получение сессий фильтров для аналитики
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const outcome = searchParams.get('outcome');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (sessionId) where.sessionId = sessionId;
    if (outcome) where.outcome = outcome;

    // Получение записей
    const filterSessions = await prisma.filterSession.findMany({
      where,
      take: Math.min(limit, 200),
      skip: offset,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        changesHistory: true,
        resultMetrics: true,
        status: true,
        durationMs: true,
        startedAt: true,
      },
    });

    // Получение общего количества
    const total = await prisma.filterSession.count({ where });

    return NextResponse.json({
      success: true,
      data: filterSessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + filterSessions.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching filter sessions', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch filter sessions' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recommendations/filter-sessions
 * Обновление результатов и метрик сессии
 */
export async function PATCH(request: NextRequest) {
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
      filterSessionId,
      resultMetrics,
      outcome,
      abandonedFilters
    } = body as {
      filterSessionId: string;
      resultMetrics?: FilterSessionResultMetrics;
      outcome?: string;
      abandonedFilters?: AbandonedFilter[];
    };

    if (!filterSessionId) {
      return NextResponse.json(
        { error: 'Missing filterSessionId' },
        { status: 400 }
      );
    }

    // Валидация исхода
    const validOutcomes = ['success', 'partial', 'abandoned', 'error'];
    if (outcome && !validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}}` },
        { status: 400 }
      );
    }

    // Обновление записи
    await prisma.filterSession.update({
      where: { id: filterSessionId },
      data: {
        resultMetrics: resultMetrics as any,
        abandonedFilters: abandonedFilters as any,
        status: outcome ? 'completed' : 'active',
        completedAt: outcome ? new Date() : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Filter session updated'
    });

  } catch (error) {
    logger.error('Error updating filter session', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to update filter session' },
      { status: 500 }
    );
  }
}
