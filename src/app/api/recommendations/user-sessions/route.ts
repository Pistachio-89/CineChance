import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { DeviceContext, SessionFlow, SessionOutcomeMetrics } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint для управления пользовательскими сессиями
 * POST /api/recommendations/user-sessions
 * 
 * UserSession отслеживает активность пользователя в рамках одной сессии
 * и агрегирует метрики взаимодействия с рекомендательной системой.
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
      deviceContext,
      sessionFlow,
      outcomeMetrics
    } = body as {
      userId: string;
      sessionId: string;
      deviceContext?: DeviceContext;
      sessionFlow?: SessionFlow;
      outcomeMetrics?: SessionOutcomeMetrics;
    };

    // Обязательные поля
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Создание записи сессии
    const userSession = await prisma.userSession.create({
      data: {
        userId,
        sessionId,
        deviceContext: deviceContext as any,
        sessionFlow: sessionFlow as any,
        outcomeMetrics: outcomeMetrics as any,
        startedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        sessionId: userSession.id,
        message: 'User session recorded successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error recording user session', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for user session' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to record user session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/user-sessions
 * Получение пользовательских сессий для аналитики
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (sessionId) where.id = sessionId;

    // Фильтр по дате
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        (where.startedAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.startedAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Получение записей
    const sessions = await prisma.userSession.findMany({
      where,
      take: Math.min(limit, 200),
      skip: offset,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        deviceContext: true,
        sessionFlow: true,
        outcomeMetrics: true,
        startedAt: true,
        endedAt: true,
        durationMs: true,
      },
    });

    // Получение общего количества
    const total = await prisma.userSession.count({ where });

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching user sessions', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch user sessions' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recommendations/user-sessions
 * Обновление метрик и завершение сессии
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
      sessionId,
      sessionFlow,
      outcomeMetrics,
      endedAt,
      durationMs
    } = body as {
      sessionId: string;
      sessionFlow?: SessionFlow;
      outcomeMetrics?: SessionOutcomeMetrics;
      endedAt?: string;
      durationMs?: number;
    };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Обновление записи
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        sessionFlow: sessionFlow as any,
        outcomeMetrics: outcomeMetrics as any,
        endedAt: endedAt ? new Date(endedAt) : new Date(),
        durationMs,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User session updated'
    });

  } catch (error) {
    logger.error('Error updating user session', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to update user session' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recommendations/user-sessions/active
 * Получение или создание активной сессии пользователя
 */
export async function PUT(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/recommendations');
  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }
  
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Поиск активной сессии (не завершённой)
    let activeSession = await prisma.userSession.findFirst({
      where: {
        userId,
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });

    // Если активной сессии нет, создаём новую
    if (!activeSession) {
      activeSession = await prisma.userSession.create({
        data: {
          userId,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          startedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      sessionId: activeSession.id,
      isNew: !activeSession.endedAt && !activeSession.durationMs,
    });

  } catch (error) {
    logger.error('Error with active session', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to process active session' },
      { status: 500 }
    );
  }
}
