// src/app/api/user/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Получаем общее количество по статусам
    const [watchedCount, wantToWatchCount, droppedCount, hiddenCount] = await Promise.all([
      // Просмотрено + Пересмотрено
      prisma.watchList.count({
        where: {
          userId,
          statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
        },
      }),
      // Хочу посмотреть
      prisma.watchList.count({
        where: { userId, statusId: MOVIE_STATUS_IDS.WANT_TO_WATCH },
      }),
      // Брошено
      prisma.watchList.count({
        where: { userId, statusId: MOVIE_STATUS_IDS.DROPPED },
      }),
      // Скрыто (blacklist)
      prisma.blacklist.count({ where: { userId } }),
    ]);

    // Получаем соотношение по типам контента (только для просмотренных)
    const watchedByType = await prisma.watchList.groupBy({
      by: ['mediaType'],
      where: {
        userId,
        statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] },
      },
      _count: { mediaType: true },
    });

    const typeCounts = {
      movie: 0,
      tv: 0,
      anime: 0,
    };

    watchedByType.forEach((item) => {
      if (item.mediaType in typeCounts) {
        typeCounts[item.mediaType as keyof typeof typeCounts] = item._count.mediaType;
      }
    });

    // Средняя оценка пользователя
    const avgRatingResult = await prisma.watchList.aggregate({
      where: {
        userId,
        userRating: { not: null },
      },
      _avg: { userRating: true },
      _count: { userRating: true },
    });

    const averageRating = avgRatingResult._avg.userRating
      ? Math.round(avgRatingResult._avg.userRating * 10) / 10
      : null;

    // Общее количество оценённых фильмов
    const ratedCount = avgRatingResult._count.userRating || 0;

    return NextResponse.json({
      total: {
        watched: watchedCount,
        wantToWatch: wantToWatchCount,
        dropped: droppedCount,
        hidden: hiddenCount,
      },
      typeBreakdown: typeCounts,
      averageRating,
      ratedCount,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
