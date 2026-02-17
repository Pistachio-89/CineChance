import { NextRequest, NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { ElementContext, SignalTemporalContext, PredictedIntent } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

// Валидные типы сигналов
const VALID_SIGNAL_TYPES = [
  'hover_start',
  'hover_end',
  'hover_duration_threshold',
  'scroll_pause',
  'element_visible',
  'interaction_pattern',
  'temporal_pattern'
];

/**
 * API endpoint для записи неявных сигналов намерений пользователя
 * POST /api/recommendations/signals
 * 
 * Поддерживает как одиночные запросы, так и батчи:
 * - Одиночный: { userId, recommendationLogId, signalType, ... }
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
      return handleBatch(body);
    }

    if (body.batch && Array.isArray(body.batch)) {
      return handleBatch(body.batch);
    }

    // Одиночный запрос
    return handleSingle(body);

  } catch (error) {
    logger.error('Error in signals POST', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to process signal request' },
      { status: 500 }
    );
  }
}

// Обработка одиночного сигнала
async function handleSingle(body: Record<string, unknown>) {
  const {
    userId,
    recommendationLogId,
    signalType,
    elementContext,
    temporalContext,
    predictedIntent
  } = body as {
    userId: string;
    recommendationLogId?: string;
    signalType: string;
    elementContext?: ElementContext;
    temporalContext?: SignalTemporalContext;
    predictedIntent?: PredictedIntent;
  };

  if (!userId || !signalType) {
    return NextResponse.json(
      { error: 'Missing required fields: userId, signalType' },
      { status: 400 }
    );
  }

  if (!VALID_SIGNAL_TYPES.includes(signalType)) {
    return NextResponse.json(
      { error: `Invalid signal type. Must be one of: ${VALID_SIGNAL_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const signal = await prisma.intentSignal.create({
      data: {
        userId,
        recommendationLogId: recommendationLogId || undefined,
        signalType,
        intensityScore: 0.5,
        elementContext: elementContext as any,
        temporalContext: temporalContext as any,
        predictedIntent: predictedIntent as any,
      },
    });

    return NextResponse.json({
      success: true,
      signalId: signal.id,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error recording intent signal', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for signal recording' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to record signal' },
      { status: 500 }
    );
  }
}

// Обработка батча сигналов
async function handleBatch(batch: Record<string, unknown>[]) {
  try {
    const signals = await prisma.$transaction(
      batch.map((item) => {
        const {
          userId,
          recommendationLogId,
          signalType,
          elementContext,
          temporalContext,
          predictedIntent
        } = item as {
          userId: string;
          recommendationLogId?: string;
          signalType: string;
          elementContext?: Record<string, unknown>;
          temporalContext?: Record<string, unknown>;
          predictedIntent?: Record<string, unknown>;
        };

        if (!userId || !signalType || !VALID_SIGNAL_TYPES.includes(signalType)) {
          return prisma.intentSignal.create({
            data: {
              userId: userId || 'unknown',
              recommendationLogId: undefined,
              signalType: 'error',
              intensityScore: 0,
              elementContext: { error: 'Invalid signal data', original: item } as any,
            },
          });
        }

        return prisma.intentSignal.create({
          data: {
            userId,
            recommendationLogId: recommendationLogId || undefined,
            signalType,
            intensityScore: 0.5,
            elementContext: elementContext as any,
            temporalContext: temporalContext as any,
            predictedIntent: predictedIntent as any,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      batchSize: signals.length,
      message: `Batch of ${signals.length} signals recorded`,
    }, { status: 201 });

  } catch (error) {
    logger.error('Error recording batch of signals', { 
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
