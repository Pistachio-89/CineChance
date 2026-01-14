import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(req: Request) {
  const { success } = await rateLimit(req, 'default');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = parseInt(searchParams.get('tmdbId') || '0');
    const mediaType = searchParams.get('mediaType');

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: 'Missing tmdbId or mediaType' }, { status: 400 });
    }

    // Получаем сессию для определения текущего пользователя
    const session = await getServerSession(authOptions);
    let userRating = null;

    // Если пользователь авторизован, получаем его оценку
    if (session?.user?.id) {
      const userRecord = await prisma.watchList.findUnique({
        where: {
          userId_tmdbId_mediaType: {
            userId: session.user.id,
            tmdbId,
            mediaType,
          },
        },
        select: {
          userRating: true,
        },
      });
      userRating = userRecord?.userRating;
    }

    // Получаем все оценки для данного фильма
    const ratings = await prisma.watchList.findMany({
      where: {
        tmdbId,
        mediaType,
        userRating: { not: null },
      },
      select: {
        userRating: true,
      },
    });

    // Вычисляем среднее
    // Извлекаем значения оценок
    const ratingValues = ratings
      .map((r: { userRating: number | null }) => r.userRating)
      .filter((r: number | null): r is number => r !== null);

    // Фильтруем NaN и значения <= 0
    const validRatings = ratingValues.filter((r: number) => 
      !isNaN(r) && r > 0
    );

    // Вычисляем среднее и округляем до 1 знака после запятой
    const averageRating = validRatings.length > 0 
      ? Math.round((validRatings.reduce((sum: number, r: number) => sum + r, 0) / validRatings.length) * 10) / 10
      : null;

    return NextResponse.json({ 
      averageRating,
      count: validRatings.length,
      userRating
    });
  } catch (error) {
    logger.error('Cine-chance rating error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
