// src/app/api/movies/batch/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from '@/middleware/rateLimit';

// Маппинг: Название в БД -> Код клиента
const STATUS_FROM_DB: Record<string, string> = {
  'Хочу посмотреть': 'want',
  'Просмотрено': 'watched',
  'Брошено': 'dropped',
  'Пересмотрено': 'rewatched',
};

export async function POST(req: Request) {
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const body = await req.json();
    const { movies } = body; // массив [{tmdbId: number, mediaType: string}]

    if (!Array.isArray(movies) || movies.length === 0) {
      return NextResponse.json({ error: 'Invalid movies array' }, { status: 400 });
    }

    // Подготовим ключи для результатов
    const result: Record<string, any> = {};

    // Инициализируем результаты для каждого фильма
    movies.forEach(({ tmdbId, mediaType }) => {
      const key = `${tmdbId}-${mediaType}`;
      result[key] = {
        status: null,
        userRating: null,
        watchedDate: null,
        watchCount: 0,
        isBlacklisted: false,
        averageRating: null,
        ratingCount: 0,
      };
    });

    // Если пользователь авторизован, получаем данные из watchlist и blacklist
    if (userId) {
      // Получаем watchlist данные
      const watchlistRecords = await prisma.watchList.findMany({
        where: {
          userId,
          OR: movies.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })),
        },
        include: {
          status: true,
        },
      });

      watchlistRecords.forEach(record => {
        const key = `${record.tmdbId}-${record.mediaType}`;
        if (result[key]) {
          const dbStatusName = record.status?.name;
          result[key].status = dbStatusName ? (STATUS_FROM_DB[dbStatusName] || null) : null;
          result[key].userRating = record.userRating;
          result[key].watchedDate = record.watchedDate;
          result[key].watchCount = record.watchCount || 0;
        }
      });

      // Получаем blacklist данные
      const blacklistRecords = await prisma.blacklist.findMany({
        where: {
          userId,
          OR: movies.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })),
        },
      });

      blacklistRecords.forEach(record => {
        const key = `${record.tmdbId}-${record.mediaType}`;
        if (result[key]) {
          result[key].isBlacklisted = true;
        }
      });
    }

    // Получаем средние рейтинги для всех фильмов
    const ratingRecords = await prisma.watchList.findMany({
      where: {
        OR: movies.map(({ tmdbId, mediaType }) => ({ tmdbId, mediaType })),
        userRating: { not: null },
      },
      select: {
        tmdbId: true,
        mediaType: true,
        userRating: true,
      },
    });

    // Группируем по tmdbId и mediaType
    const ratingsByMovie: Record<string, number[]> = {};
    ratingRecords.forEach(record => {
      const key = `${record.tmdbId}-${record.mediaType}`;
      if (!ratingsByMovie[key]) {
        ratingsByMovie[key] = [];
      }
      if (record.userRating && !isNaN(record.userRating) && record.userRating > 0) {
        ratingsByMovie[key].push(record.userRating);
      }
    });

    // Вычисляем средние
    Object.keys(ratingsByMovie).forEach(key => {
      const ratings = ratingsByMovie[key];
      if (ratings.length > 0) {
        const average = Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
        if (result[key]) {
          result[key].averageRating = average;
          result[key].ratingCount = ratings.length;
        }
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Movies batch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}