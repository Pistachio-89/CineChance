import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const statusesParam = searchParams.get('statuses');
    
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    
    // Определяем фильтр по статусам
    let statusFilter = {};
    if (statusesParam) {
      const statusList = statusesParam.split(',').map(s => s.trim().toLowerCase());
      
      if (statusList.includes('watched') || statusList.includes('rewatched')) {
        statusFilter = {
          statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] }
        };
      }
    }

    // Получаем теги пользователя с подсчётом реального использования
    const tags = await prisma.tag.findMany({
      where: {
        userId,
      },
      include: {
        _count: {
          select: {
            watchLists: statusFilter ? {
              where: statusFilter
            } : true
          }
        }
      },
      orderBy: {
        usageCount: 'desc'
      },
      take: limit,
    });

    // Форматируем результат
    const formattedTags = tags
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        count: tag._count.watchLists,
      }))
      .filter(tag => tag.count > 0) // Только теги с использованием
      .sort((a, b) => b.count - a.count); // Сортируем по реальному количеству

    const response = NextResponse.json({ tags: formattedTags });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching tag usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag usage' },
      { status: 500 }
    );
  }
}