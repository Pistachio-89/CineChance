// src/app/api/recommendations/[id]/action/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication FIRST to get userId for user-based rate limiting
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Apply rate limiting with userId for per-user limits (not IP-based)
  const { success } = await rateLimit(req, '/api/recommendations', userId);
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const { id } = await params;

    // Проверяем запись - используем select для минимизации данных
    const logEntry = await prisma.recommendationLog.findFirst({
      where: { id, userId },
      select: { id: true, tmdbId: true, mediaType: true, context: true },
    });

    if (!logEntry) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
    }

    const body = await req.json();
    const { action, additionalData } = body;

    const validActions = ['skipped', 'opened', 'watched', 'added_to_list'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: 'Недопустимое действие' }, { status: 400 });
    }

    // Транзакция для атомарного обновления
    const updatedLog = await prisma.$transaction(async (tx) => {
      const updated = await tx.recommendationLog.update({
        where: { id },
        data: {
          action,
          context: {
            ...((logEntry.context as object) || {}),
            actionTakenAt: new Date().toISOString(),
            additionalData: additionalData || null,
          },
        },
      });

      // Обновление watchlist если нужно
      if (action === 'added_to_list' || action === 'watched') {
        const statusMap: Record<string, string> = {
          added_to_list: 'Хочу посмотреть',
          watched: 'Просмотрено',
        };

        const status = await tx.movieStatus.findUnique({
          where: { name: statusMap[action] },
          select: { id: true },
        });

        if (status) {
          await tx.watchList.upsert({
            where: {
              userId_tmdbId_mediaType: {
                userId,
                tmdbId: logEntry.tmdbId,
                mediaType: logEntry.mediaType,
              },
            },
            update: { statusId: status.id },
            create: {
              userId,
              tmdbId: logEntry.tmdbId,
              mediaType: logEntry.mediaType,
              title: '',
              voteAverage: 0,
              statusId: status.id,
            },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: 'Действие записано',
      logId: updatedLog.id,
    });
  } catch (error) {
    logger.error('Recommendation action error', {
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations',
    });
    return NextResponse.json({ error: 'Ошибка при записи действия' }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication FIRST to get userId for user-based rate limiting
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Apply rate limiting with userId for per-user limits (not IP-based)
  const { success } = await rateLimit(req, '/api/recommendations', userId);
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const { id } = await params;

    // Оптимизированный запрос - выбираем только необходимые поля
    const logEntry = await prisma.recommendationLog.findFirst({
      where: { id, userId },
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        action: true,
        algorithm: true,
        score: true,
        shownAt: true,
        context: true,
      },
    });

    if (!logEntry) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      log: logEntry,
    });
  } catch (error) {
    logger.error('Get recommendation log error', {
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations',
    });
    return NextResponse.json({ error: 'Ошибка при получении записи' }, { status: 500 });
  }
}
