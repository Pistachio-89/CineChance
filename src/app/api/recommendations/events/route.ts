import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RecommendationEventData, FilterChangeEventData, ActionClickEventData, HoverEventData } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint для записи событий взаимодействия с рекомендациями
 * POST /api/recommendations/events
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
      recommendationLogId,
      eventType,
      eventData,
      timestamp
    } = body as {
      userId: string;
      recommendationLogId: string;
      eventType: string;
      eventData: RecommendationEventData;
      timestamp?: string;
    };

    // Обязательные поля
    if (!userId || !recommendationLogId || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, recommendationLogId, eventType' },
        { status: 400 }
      );
    }

    // Валидация типа события
    const validEventTypes = [
      'filter_change',
      'action_click',
      'hover_start',
      'hover_end',
      'page_view',
      'scroll_depth',
      'session_start',
      'session_end'
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Валидация данных события в зависимости от типа
    if (eventData) {
      const validationResult = validateEventData(eventType, eventData);
      if (!validationResult.valid) {
        return NextResponse.json(
          { error: `Invalid event data for ${eventType}: ${validationResult.error}` },
          { status: 400 }
        );
      }
    }

    // Создание записи события
    const event = await prisma.recommendationEvent.create({
      data: {
        userId,
        parentLogId: recommendationLogId,
        eventType,
        eventData: eventData as any,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        eventId: event.id,
        message: 'Event recorded successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error recording recommendation event', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for event recording' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to record event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/events
 * Получение событий для аналитики (опционально)
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
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (eventType) where.eventType = eventType;

    // Получение событий
    const events = await prisma.recommendationEvent.findMany({
      where,
      take: Math.min(limit, 100), // Ограничение максимум 100 записей
      skip: offset,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        userId: true,
        parentLogId: true,
        eventType: true,
        eventData: true,
        timestamp: true,
      },
    });

    // Получение общего количества
    const total = await prisma.recommendationEvent.count({ where });

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching recommendation events', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * Валидация данных события в зависимости от типа
 */
function validateEventData(
  eventType: string,
  eventData: Record<string, unknown>
): { valid: boolean; error?: string } {
  switch (eventType) {
    case 'filter_change': {
      const data = eventData as FilterChangeEventData;
      if (!data.parameterName || data.previousValue === undefined || data.newValue === undefined) {
        return { valid: false, error: 'Missing required fields: parameterName, previousValue, newValue' };
      }
      if (!['user_input', 'preset', 'api', 'reset'].includes(data.changeSource)) {
        return { valid: false, error: 'Invalid changeSource value' };
      }
      break;
    }

    case 'action_click': {
      const data = eventData as ActionClickEventData;
      if (!data.action || data.timeSinceShownMs === undefined) {
        return { valid: false, error: 'Missing required fields: action, timeSinceShownMs' };
      }
      if (!['accept', 'skip', 'open_details', 'back_to_filters'].includes(data.action)) {
        return { valid: false, error: 'Invalid action value' };
      }
      break;
    }

    case 'hover_start':
    case 'hover_end': {
      const data = eventData as HoverEventData;
      if (!data.elementType || data.elementPosition === undefined || data.hoverDurationMs === undefined) {
        return { valid: false, error: 'Missing required fields: elementType, elementPosition, hoverDurationMs' };
      }
      if (!['poster', 'title', 'rating', 'genres', 'description'].includes(data.elementType)) {
        return { valid: false, error: 'Invalid elementType value' };
      }
      break;
    }

    case 'page_view':
    case 'scroll_depth': {
      if (eventData.depth !== undefined && (typeof eventData.depth !== 'number' || eventData.depth < 0 || eventData.depth > 100)) {
        return { valid: false, error: 'Invalid scroll depth value (must be 0-100)' };
      }
      break;
    }

    case 'session_start':
    case 'session_end': {
      // Эти события не требуют дополнительных данных
      break;
    }
  }

  return { valid: true };
}
