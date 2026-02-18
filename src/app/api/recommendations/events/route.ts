import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { RecommendationEventData } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

// Валидные типы событий
const VALID_EVENT_TYPES = [
  'filter_change',
  'action_click',
  'hover_start',
  'hover_end',
  'page_view',
  'scroll_depth',
  'session_start',
  'session_end'
];

/**
 * API endpoint для записи событий взаимодействия с рекомендациями
 * POST /api/recommendations/events
 * 
 * Поддерживает как одиночные запросы, так и батчи:
 * - Одиночный: { userId, recommendationLogId, eventType, eventData, timestamp }
 * - Батч: { batch: [...] }
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

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Проверка на batch-запрос
    if (Array.isArray(body)) {
      return handleBatch(request, body);
    }

    if (body.batch && Array.isArray(body.batch)) {
      return handleBatch(request, body.batch);
    }

    // Одиночный запрос
    return handleSingle(request, body);

  } catch (error) {
    logger.error('Error in events POST', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to process event request' },
      { status: 500 }
    );
  }
}

// Обработка одиночного события
async function handleSingle(request: NextRequest, body: Record<string, unknown>) {
  const {
    userId,
    recommendationLogId,
    eventType,
    eventData,
    timestamp
  } = body as {
    userId: string;
    recommendationLogId?: string;
    eventType: string;
    eventData?: RecommendationEventData;
    timestamp?: string;
  };

  if (!userId || !eventType) {
    return NextResponse.json(
      { error: 'Missing required fields: userId, eventType' },
      { status: 400 }
    );
  }

  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      { error: `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const event = await prisma.recommendationEvent.create({
      data: {
        userId,
        parentLogId: recommendationLogId || undefined,
        eventType,
        eventData: eventData as any,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.id,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error recording recommendation event', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

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

// Обработка батча событий
async function handleBatch(request: NextRequest, batch: Record<string, unknown>[]) {
  try {
    const events = await prisma.$transaction(
      batch.map((item) => {
        const {
          userId,
          recommendationLogId,
          eventType,
          eventData,
          timestamp
        } = item as {
          userId: string;
          recommendationLogId?: string;
          eventType: string;
          eventData?: Record<string, unknown>;
          timestamp?: string;
        };

        if (!userId || !eventType || !VALID_EVENT_TYPES.includes(eventType)) {
          return prisma.recommendationEvent.create({
            data: {
              userId: userId || 'unknown',
              parentLogId: undefined,
              eventType: 'error',
              eventData: { error: 'Invalid event data', original: item } as any,
              timestamp: new Date(),
            },
          });
        }

        return prisma.recommendationEvent.create({
          data: {
            userId,
            parentLogId: recommendationLogId || undefined,
            eventType,
            eventData: eventData as any,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      batchSize: events.length,
      message: `Batch of ${events.length} events recorded`,
    }, { status: 201 });

  } catch (error) {
    logger.error('Error recording batch of events', { 
      error: error instanceof Error ? error.message : String(error),
      batchSize: batch.length,
      context: 'Recommendations'
    });

    return NextResponse.json(
      { error: 'Failed to record batch' },
      { status: 500 }
    );
  }
}
