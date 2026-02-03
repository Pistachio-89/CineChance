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
  // Use watchlist rate limit for batch operations
  const { success } = await rateLimit(req, '/api/watchlist');
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
      // Build arrays for efficient querying
      const movieIds = movies.map(m => m.tmdbId);
      const mediaTypes = Array.from(new Set(movies.map(m => m.mediaType)));
      
      // Получаем watchlist данные - используем where IN для эффективности
      // Оптимизировано: используем select вместо include
      const watchlistRecords = await prisma.watchList.findMany({
        where: {
          userId,
          tmdbId: { in: movieIds },
          mediaType: { in: mediaTypes },
        },
        select: {
          tmdbId: true,
          mediaType: true,
          status: { select: { name: true } },
          userRating: true,
          weightedRating: true, // Добавляем взвешенную оценку
          watchedDate: true,
          watchCount: true,
        },
      });

      watchlistRecords.forEach(record => {
        const key = `${record.tmdbId}-${record.mediaType}`;
        if (result[key]) {
          const dbStatusName = record.status?.name;
          result[key].status = dbStatusName ? (STATUS_FROM_DB[dbStatusName] || null) : null;
          result[key].userRating = record.weightedRating ?? record.userRating; // Используем взвешенную оценку
          result[key].watchedDate = record.watchedDate;
          result[key].watchCount = record.watchCount || 0;
        }
      });

      // Получаем blacklist данные
      const blacklistRecords = await prisma.blacklist.findMany({
        where: {
          userId,
          tmdbId: { in: movieIds },
          mediaType: { in: mediaTypes },
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
    const movieIds = movies.map(m => m.tmdbId);
    const mediaTypes = Array.from(new Set(movies.map(m => m.mediaType)));
    
    const ratingRecords = await prisma.watchList.findMany({
      where: {
        tmdbId: { in: movieIds },
        mediaType: { in: mediaTypes },
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