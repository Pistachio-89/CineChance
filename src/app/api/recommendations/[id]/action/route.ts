import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/recommendations/[id]/action
 * Записать действие пользователя с рекомендацией
 * 
 * Параметры URL:
 * - id: ID записи в RecommendationLog
 * 
 * Тело запроса:
 * - action: 'skipped' | 'opened' | 'watched' | 'added_to_list'
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id as string;

    // Проверяем, что запись существует и принадлежит пользователю
    const logEntry = await prisma.recommendationLog.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!logEntry) {
      return NextResponse.json(
        { error: 'Запись не найдена' },
        { status: 404 }
      );
    }

    // Получаем тело запроса
    const body = await req.json();
    const { action, additionalData } = body;

    // Валидация действия
    const validActions = ['skipped', 'opened', 'watched', 'added_to_list'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Недопустимое действие' },
        { status: 400 }
      );
    }

    // Обновляем запись
    const updatedLog = await prisma.recommendationLog.update({
      where: { id },
      data: {
        action,
        context: {
          ...(logEntry.context as object || {}),
          actionTakenAt: new Date().toISOString(),
          additionalData: additionalData || null,
        },
      },
    });

    // Если пользователь добавил в список или отметил как просмотренное,
    // обновляем запись в WatchList
    if (action === 'added_to_list' || action === 'watched') {
      const statusMap: Record<string, string> = {
        added_to_list: 'Хочу посмотреть',
        watched: 'Просмотрено',
      };

      const status = await prisma.movieStatus.findUnique({
        where: { name: statusMap[action] },
      });

      if (status) {
        await prisma.watchList.upsert({
          where: {
            userId_tmdbId_mediaType: {
              userId,
              tmdbId: logEntry.tmdbId,
              mediaType: logEntry.mediaType,
            },
          },
          update: {
            statusId: status.id,
          },
          create: {
            userId,
            tmdbId: logEntry.tmdbId,
            mediaType: logEntry.mediaType,
            title: '', // Будет заполнено при обновлении данных
            voteAverage: 0,
            statusId: status.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Действие записано',
      logId: updatedLog.id,
    });
  } catch (error) {
    logger.error('Recommendation action error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Ошибка при записи действия' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendations/[id]/action
 * Получить информацию о записи рекомендации
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id as string;

    const logEntry = await prisma.recommendationLog.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!logEntry) {
      return NextResponse.json(
        { error: 'Запись не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      log: {
        id: logEntry.id,
        tmdbId: logEntry.tmdbId,
        mediaType: logEntry.mediaType,
        action: logEntry.action,
        algorithm: logEntry.algorithm,
        score: logEntry.score,
        shownAt: logEntry.shownAt,
        context: logEntry.context,
      },
    });
  } catch (error) {
    logger.error('Get recommendation log error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { error: 'Ошибка при получении записи' },
      { status: 500 }
    );
  }
}
