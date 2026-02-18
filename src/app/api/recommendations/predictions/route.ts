import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * API endpoint для логирования ML-предсказаний
 * POST /api/recommendations/predictions
 * 
 * Используется для записи предсказаний ML-моделей и их последующей оценки.
 * Позволяет отслеживать качество моделей и проводить A/B тестирование.
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
      modelVersion,
      predictedScore,
      actualAction,
      featureVector,
      inferenceTimeMs: _inferenceTimeMs
    } = body as {
      userId: string;
      recommendationLogId: string;
      modelVersion?: string;
      predictedScore: number;
      actualAction?: string;
      featureVector?: Record<string, unknown>;
      inferenceTimeMs?: number;
    };

    // Обязательные поля
    if (!userId || !recommendationLogId || predictedScore === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, recommendationLogId, predictedScore' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли запись recommendationLog
    const logExists = await prisma.recommendationLog.findUnique({
      where: { id: recommendationLogId },
      select: { id: true }
    });

    if (!logExists) {
      return NextResponse.json(
        { error: 'RecommendationLog not found' },
        { status: 404 }
      );
    }

    // Создание записи предсказания
    const prediction = await prisma.predictionLog.create({
      data: {
        userId,
        recommendationLogId,
        modelVersion,
        predictedScore,
        actualAction,
        featureVector: featureVector as any,
      },
    });

    // Обновляем связь в RecommendationLog
    await prisma.recommendationLog.update({
      where: { id: recommendationLogId },
      data: {
        prediction: { connect: { id: prediction.id } }
      }
    });

    return NextResponse.json(
      {
        success: true,
        predictionId: prediction.id,
        message: 'Prediction logged successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error logging prediction', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for prediction logging' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to log prediction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/predictions
 * Получение логов предсказаний для аналитики моделей
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
    const modelVersion = searchParams.get('modelVersion');
    const modelName = searchParams.get('modelName');
    const hasActualOutcome = searchParams.get('hasActualOutcome');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (modelVersion) where.modelVersion = modelVersion;
    if (modelName) where.modelName = modelName;
    if (hasActualOutcome === 'true') {
      where.actualAction = { not: null };
    } else if (hasActualOutcome === 'false') {
      where.actualAction = null;
    }

    // Получение записей
    const predictions = await prisma.predictionLog.findMany({
      where,
      take: Math.min(limit, 500),
      skip: offset,
      orderBy: { computedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        recommendationLogId: true,
        modelVersion: true,
        predictedScore: true,
        actualAction: true,
        featureVector: true,
        computedAt: true,
      },
    });

    // Получение общего количества
    const total = await prisma.predictionLog.count({ where });

    return NextResponse.json({
      success: true,
      data: predictions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + predictions.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching predictions', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recommendations/predictions
 * Обновление фактического результата для оценки качества модели
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

    const { predictionId, actualAction } = body as {
      predictionId: string;
      actualAction?: string;
    };

    if (!predictionId) {
      return NextResponse.json(
        { error: 'Missing predictionId' },
        { status: 400 }
      );
    }

    // Обновление фактического результата
    await prisma.predictionLog.update({
      where: { id: predictionId },
      data: {
        actualAction,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Prediction outcome updated'
    });

  } catch (error) {
    logger.error('Error updating prediction', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to update prediction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/predictions/accuracy
 * Получение метрик точности модели
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
    const { searchParams } = new URL(request.url);
    const modelVersion = searchParams.get('modelVersion');
    const _modelName = searchParams.get('modelName');

    // Построение фильтра
    const where: Record<string, unknown> = {
      actualAction: { not: null },
    };

    if (modelVersion) where.modelVersion = modelVersion;

    // Получение всех предсказаний с известными результатами
    const predictions = await prisma.predictionLog.findMany({
      where,
      select: {
        predictedScore: true,
        actualAction: true,
      },
    });

    if (predictions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No predictions with known outcomes found',
        metrics: null
      });
    }

    // TODO: Implement analytics based on predictedScore and actualAction
    return NextResponse.json({
      success: true,
      message: 'Analytics not implemented yet',
      metrics: null
    });

  } catch (error) {
    logger.error('Error calculating accuracy', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to calculate accuracy' },
      { status: 500 }
    );
  }
}
