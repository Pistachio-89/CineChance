import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { ContextualFactors, CorrectiveAction } from '@/lib/recommendation-types';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { trackOutcome } from '@/lib/recommendation-outcome-tracking';

/**
 * API endpoint для записи негативной обратной связи от пользователя
 * POST /api/recommendations/negative-feedback
 * 
 * Негативная обратная связь используется для корректировки алгоритма
 * и исключения нерелевантных рекомендаций из будущих предложений.
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
      feedbackType,
      detailedReason,
      contextualFactors,
      correctiveAction
    } = body as {
      userId: string;
      recommendationLogId: string;
      feedbackType: string;
      detailedReason?: string;
      contextualFactors?: ContextualFactors;
      correctiveAction?: CorrectiveAction;
    };

    // Обязательные поля
    if (!userId || !recommendationLogId || !feedbackType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, recommendationLogId, feedbackType' },
        { status: 400 }
      );
    }

    // Валидация типа обратной связи
    const validFeedbackTypes = [
      'not_interested',
      'already_watched',
      'wrong_genre',
      'bad_rating',
      'uninteresting_plot',
      'wrong_year',
      'already_in_list',
      'too_similar',
      'other'
    ];

    if (!validFeedbackTypes.includes(feedbackType)) {
      return NextResponse.json(
        { error: `Invalid feedback type. Must be one of: ${validFeedbackTypes.join(', ')}}` },
        { status: 400 }
      );
    }

    // Проверяем, существует ли запись recommendationLog
    const logExists = await prisma.recommendationLog.findUnique({
      where: { id: recommendationLogId },
      select: { id: true, tmdbId: true, mediaType: true }
    });

    if (!logExists) {
      return NextResponse.json(
        { error: 'RecommendationLog not found' },
        { status: 404 }
      );
    }

    // Создание записи негативной обратной связи
    const feedback = await prisma.negativeFeedback.create({
      data: {
        userId,
        recommendationLogId,
        feedbackType,
        detailedReason,
        contextualFactors: contextualFactors as any,
        correctiveAction: correctiveAction as any,
      },
    });

    // Добавление в blacklist если пользователь указал "already_watched"
    if (feedbackType === 'already_watched') {
      await prisma.blacklist.create({
        data: {
          userId,
          tmdbId: logExists.tmdbId,
          mediaType: logExists.mediaType,
        },
      }).catch(() => {
        // Игнорируем ошибку если запись уже существует
      });
    }

    // Track outcome: user gave negative feedback (hidden)
    // Это важный сигнал для ML - пользователь явно скрыл эту рекомендацию
    await trackOutcome({
      recommendationLogId,
      userId,
      action: 'hidden',
    });
    logger.info('Outcome tracked: recommendation hidden via negative feedback', {
      recommendationLogId,
      feedbackType,
      userId,
      context: 'negative-feedback-api',
    });

    return NextResponse.json(
      {
        success: true,
        feedbackId: feedback.id,
        message: 'Negative feedback recorded successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error recording negative feedback', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });

    // Обработка ошибок Prisma
    if (error instanceof Error && error.name === 'PrismaClientValidationError') {
      return NextResponse.json(
        { error: 'Invalid data format for feedback recording' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/negative-feedback
 * Получение негативной обратной связи для аналитики
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
    const recommendationLogId = searchParams.get('recommendationLogId');
    const feedbackType = searchParams.get('feedbackType');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Построение фильтра
    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (recommendationLogId) where.recommendationLogId = recommendationLogId;
    if (feedbackType) where.feedbackType = feedbackType;

    // Получение записей
    const feedbacks = await prisma.negativeFeedback.findMany({
      where,
      take: Math.min(limit, 200),
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        recommendationLogId: true,
        feedbackType: true,
        detailedReason: true,
        contextualFactors: true,
        createdAt: true,
      },
    });

    // Получение общего количества
    const total = await prisma.negativeFeedback.count({ where });

    return NextResponse.json({
      success: true,
      data: feedbacks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + feedbacks.length < total,
      }
    });

  } catch (error) {
    logger.error('Error fetching negative feedback', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recommendations/negative-feedback
 * Применение корректирующего действия (для админ-панели)
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

    const { feedbackId, suggestedWeightAdjustment, suggestedFilterAdjustment, applied } = body as {
      feedbackId: string;
      suggestedWeightAdjustment?: Record<string, number>;
      suggestedFilterAdjustment?: Record<string, unknown>;
      applied?: boolean;
    };

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Missing feedbackId' },
        { status: 400 }
      );
    }

    // Обновление корректирующего действия
    const correctiveAction: CorrectiveAction = {
      suggestedWeightAdjustment: suggestedWeightAdjustment,
      suggestedFilterAdjustment: suggestedFilterAdjustment,
      confidence: 0.8, // Значение по умолчанию
      applied: applied || false,
    };

    await prisma.negativeFeedback.update({
      where: { id: feedbackId },
      data: {
        correctiveAction: correctiveAction as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Corrective action updated'
    });

  } catch (error) {
    logger.error('Error updating negative feedback', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}
