import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ElementContext, SignalTemporalContext, PredictedIntent } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';

/**
 * API endpoint для записи неявных сигналов намерений пользователя
 * POST /api/recommendations/signals
 * 
 * Сигналы намерений - это неявные сигналы поведения пользователя,
 * которые позволяют ML-моделям предсказывать интерес к контенту.
 */
export async function POST(request: NextRequest) {
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
      signalType,
      elementContext,
      temporalContext,
      predictedIntent
    } = body as {
      userId: string;
      recommendationLogId: string;
      signalType: string;
      elementContext?: ElementContext;
      temporalContext?: SignalTemporalContext;
      predictedIntent?: PredictedIntent;
    };

    // Обязательные поля
    if (!userId || !recommendationLogId || !signalType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, recommendationLogId, signalType' },
        { status: 400 }
      );
    }

    // Валидация типа сигнала
    const validSignalTypes = [
      'hover_start',
      'hover_end',
      'hover_duration_threshold',
      'scroll_pause',
      'element_visible',
      'interaction_pattern',
      'temporal_pattern'
    ];

    if (!validSignalTypes.includes(signalType)) {
      return NextResponse.json(
        { error: `Invalid signal type. Must be one of: ${validSignalTypes.join(', ')}}` },
        { status: 400 }
      );
    }

    // Создание записи сигнала
    const signal = await prisma.intentSignal.create({
      data: {
        userId,
        recommendationLogId,
        signalType,
        intensityScore: 0.5, // TODO: calculate intensity
        elementContext: elementContext as any,
        temporalContext: temporalContext as any,
        predictedIntent: predictedIntent as any,
      },
    });

    return NextResponse.json(
      {
        success: true,
        signalId: signal.id,
        message: 'Intent signal recorded successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error recording intent signal', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
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

/**
 * GET /api/recommendations/signals
 * Получение сигналов для аналитики и ML-пайплайнов
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const recommendationLogId = searchParams.get('recommendationLogId');
    const signalType = searchParams.get('signalType');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (recommendationLogId) where.recommendationLogId = recommendationLogId;
    if (signalType) where.signalType = signalType;

    // Получение сигналов
    const signals = await prisma.intentSignal.findMany({
      where,
      take: Math.min(limit, 500), // Ограничение максимум 500 записей
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        recommendationLogId: true,
        signalType: true,
        intensityScore: true,
        elementContext: true,
        temporalContext: true,
        predictedIntent: true,
        createdAt: true,
      },
    });

    // Получение общего количества
    const total = await prisma.intentSignal.count({ where });

    return NextResponse.json({
      success: true,
      data: signals,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + signals.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching intent signals', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recommendations/signals
 * Обновление статуса обработки сигналов (для ML-пайплайнов)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { signalIds, modelVersion, intentPrediction } = body as {
      signalIds: string[];
      modelVersion?: string;
      intentPrediction?: Record<string, unknown>;
    };

    if (!signalIds || !Array.isArray(signalIds) || signalIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty signalIds array' },
        { status: 400 }
      );
    }

    // Обновление данных
    const updateData: Record<string, unknown> = {};

    if (intentPrediction) {
      updateData.predictedIntent = intentPrediction;
    }

    await prisma.intentSignal.updateMany({
      where: {
        id: { in: signalIds },
      },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${signalIds.length} signals updated`
    });

  } catch (error) {
    logger.error('Error updating intent signals', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to update signals' },
      { status: 500 }
    );
  }
}
