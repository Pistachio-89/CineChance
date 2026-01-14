// src/app/api/watchlist/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Маппинг: Код клиента -> Название в БД
const STATUS_TO_DB: Record<string, string> = {
  want: 'Хочу посмотреть',
  watched: 'Просмотрено',
  dropped: 'Брошено',
  rewatched: 'Пересмотрено',
};

// Маппинг: Название в БД -> Код клиента
const STATUS_FROM_DB: Record<string, string> = {
  'Хочу посмотреть': 'want',
  'Просмотрено': 'watched',
  'Брошено': 'dropped',
  'Пересмотрено': 'rewatched',
};

// GET: Получить статус фильма для текущего пользователя
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ status: null }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const tmdbId = parseInt(searchParams.get('tmdbId') || '0');
    const mediaType = searchParams.get('mediaType');

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const record = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId: session.user.id,
          tmdbId,
          mediaType,
        },
      },
      include: {
        status: true,
      },
    });

    // Переводим название из БД в код клиента
    const dbStatusName = record?.status?.name;
    const clientStatus = dbStatusName ? (STATUS_FROM_DB[dbStatusName] || null) : null;

    // Возвращаем статус и данные оценки (если есть)
    return NextResponse.json({ 
      status: clientStatus,
      userRating: record?.userRating,
      watchedDate: record?.watchedDate,
      watchCount: record?.watchCount || 0,
    });
  } catch (error) {
    logger.error('WatchList GET error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Watchlist'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Добавить или обновить статус
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, mediaType, status, title, voteAverage, userRating, watchedDate, isRewatch, isRatingOnly } = body;

    // При переоценке без смены статуса - не требуем статус
    if (isRatingOnly) {
      if (!tmdbId || !mediaType) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Получаем текущую запись
      const existingRecord = await prisma.watchList.findUnique({
        where: {
          userId_tmdbId_mediaType: {
            userId: session.user.id,
            tmdbId,
            mediaType,
          },
        },
      });

      if (!existingRecord) {
        return NextResponse.json({ error: 'Movie not found in watchlist' }, { status: 404 });
      }

      const previousRating = existingRecord.userRating;
      const newRating = userRating ? Number(userRating) : null;
      const isRatingChanged = newRating !== null && previousRating !== newRating;

      // Обновляем только оценку
      await prisma.watchList.update({
        where: {
          userId_tmdbId_mediaType: {
            userId: session.user.id,
            tmdbId,
            mediaType,
          },
        },
        data: {
          userRating: newRating,
          title,
          voteAverage,
        },
      });

      // Логируем изменение оценки
      if (isRatingChanged && newRating !== null) {
        await prisma.ratingHistory.create({
          data: {
            userId: session.user.id,
            tmdbId,
            mediaType,
            rating: newRating,
            actionType: 'rating_change',
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Логика пересмотра - обновляем только оценку и счётчик просмотров, НЕ меняем статус
    if (isRewatch) {
      if (!tmdbId || !mediaType || !title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Получаем текущую запись
      const existingRecord = await prisma.watchList.findUnique({
        where: {
          userId_tmdbId_mediaType: {
            userId: session.user.id,
            tmdbId,
            mediaType,
          },
        },
      });

      const previousWatchCount = existingRecord?.watchCount || 0;
      const previousRating = existingRecord?.userRating;
      const newRating = userRating ? Number(userRating) : null;
      const isRatingChanged = existingRecord && newRating !== null && previousRating !== newRating;

      // Получаем ID статуса "Пересмотрено" для создания/обновления записи
      const rewatchedStatus = await prisma.movieStatus.findUnique({
        where: { name: 'Пересмотрено' },
      });

      if (!rewatchedStatus) {
        return NextResponse.json({ error: 'Status "Пересмотрено" not found' }, { status: 404 });
      }

      // Обновляем существующую запись или создаём новую
      await prisma.watchList.upsert({
        where: {
          userId_tmdbId_mediaType: {
            userId: session.user.id,
            tmdbId,
            mediaType,
          },
        },
        update: {
          statusId: rewatchedStatus.id,
          title,
          voteAverage,
          userRating: newRating,
          watchedDate: watchedDate ? new Date(watchedDate) : null,
          watchCount: previousWatchCount + 1,
        },
        create: {
          userId: session.user.id,
          tmdbId,
          mediaType,
          title,
          voteAverage,
          statusId: rewatchedStatus.id,
          userRating: newRating,
          watchedDate: watchedDate ? new Date(watchedDate) : null,
          watchCount: 1,
        },
      });

      // Логируем пересмотр
      await prisma.rewatchLog.create({
        data: {
          userId: session.user.id,
          tmdbId,
          mediaType,
          previousWatchCount,
        },
      });

      // Логируем изменение оценки
      if (isRatingChanged && newRating !== null) {
        await prisma.ratingHistory.create({
          data: {
            userId: session.user.id,
            tmdbId,
            mediaType,
            rating: newRating,
            actionType: 'rewatch',
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Обычная логика добавления/изменения статуса
    if (!tmdbId || !mediaType || !status || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Переводим код клиента в название для БД
    const dbStatusName = STATUS_TO_DB[status];

    if (!dbStatusName) {
      return NextResponse.json({ error: 'Invalid status name sent from client' }, { status: 400 });
    }

    // Ищем ID статуса в БД по русскому названию
    const statusRecord = await prisma.movieStatus.findUnique({
      where: { name: dbStatusName },
    });

    if (!statusRecord) {
      return NextResponse.json({ error: 'Status not found in DB' }, { status: 404 });
    }

    // Получаем текущую запись для логирования пересмотра
    const existingRecord = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId: session.user.id,
          tmdbId,
          mediaType,
        },
      },
    });

    const previousWatchCount = existingRecord?.watchCount || 0;
    const previousRating = existingRecord?.userRating;
    const newRating = userRating ? Number(userRating) : null;
    const isRatingChanged = existingRecord && newRating !== null && previousRating !== newRating;

    const record = await prisma.watchList.upsert({
      where: {
        userId_tmdbId_mediaType: {
          userId: session.user.id,
          tmdbId,
          mediaType,
        },
      },
      update: {
        statusId: statusRecord.id,
        title,
        voteAverage,
        userRating: newRating,
        watchedDate: watchedDate ? new Date(watchedDate) : null,
        watchCount: isRewatch ? previousWatchCount + 1 : previousWatchCount,
      },
      create: {
        userId: session.user.id,
        tmdbId,
        mediaType,
        title,
        voteAverage,
        statusId: statusRecord.id,
        userRating: newRating,
        watchedDate: watchedDate ? new Date(watchedDate) : null,
        watchCount: isRewatch ? 1 : 0,
      },
    });

    // Логируем пересмотр, если это повторный просмотр
    if (isRewatch && existingRecord) {
      // Создаём запись в RewatchLog
      await prisma.rewatchLog.create({
        data: {
          userId: session.user.id,
          tmdbId,
          mediaType,
          ratingBefore: previousRating,
          ratingAfter: newRating,
          previousWatchCount,
        },
      });
    }

    // Логируем изменение оценки в RatingHistory
    if (isRatingChanged && newRating !== null) {
      await prisma.ratingHistory.create({
        data: {
          userId: session.user.id,
          tmdbId,
          mediaType,
          rating: newRating,
          actionType: isRewatch ? 'rewatch' : 'rating_change',
        },
      });
    } else if (!existingRecord && newRating !== null) {
      // Первичная оценка
      await prisma.ratingHistory.create({
        data: {
          userId: session.user.id,
          tmdbId,
          mediaType,
          rating: newRating,
          actionType: 'initial',
        },
      });
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    logger.error('WatchList POST error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Watchlist'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Удалить из списка
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tmdbId, mediaType } = body;

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    await prisma.watchList.deleteMany({
      where: {
        userId: session.user.id,
        tmdbId,
        mediaType,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('WatchList DELETE error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Watchlist'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}