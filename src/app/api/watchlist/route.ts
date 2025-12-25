// src/app/api/watchlist/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

// Маппинг: Код клиента -> Название в БД
const STATUS_TO_DB: Record<string, string> = {
  want: 'Хочу посмотреть',
  watched: 'Просмотрено',
  dropped: 'Брошено',
};

// Маппинг: Название в БД -> Код клиента
const STATUS_FROM_DB: Record<string, string> = {
  'Хочу посмотреть': 'want',
  'Просмотрено': 'watched',
  'Брошено': 'dropped',
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
    });
  } catch (error) {
    console.error('WatchList GET error:', error);
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
    const { tmdbId, mediaType, status, title, voteAverage, userRating, watchedDate } = body;

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
        // Обновляем оценку и дату, если они переданы
        userRating: userRating ? Number(userRating) : null,
        watchedDate: watchedDate ? new Date(watchedDate) : null,
      },
      create: {
        userId: session.user.id,
        tmdbId,
        mediaType,
        title,
        voteAverage,
        statusId: statusRecord.id,
        // Создаем с оценкой и датой, если они переданы
        userRating: userRating ? Number(userRating) : null,
        watchedDate: watchedDate ? new Date(watchedDate) : null,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('WatchList POST error:', error);
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
    console.error('WatchList DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}