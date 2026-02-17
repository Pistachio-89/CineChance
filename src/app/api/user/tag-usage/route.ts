import { NextRequest, NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';
import { withCache } from '@/lib/redis';
import { logger } from '@/lib/logger';

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
    
    const cacheKey = `user:${userId}:tag_usage:all:${statusesParam || 'default'}`;

    const fetchTags = async () => {
      // По умолчанию включаем все значимые статусы для статистики
      let statusFilter = {
        statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED, MOVIE_STATUS_IDS.DROPPED] }
      };
      if (statusesParam) {
        const statusList = statusesParam.split(',').map(s => s.trim().toLowerCase());
        
        if (statusList.includes('watched') || statusList.includes('rewatched')) {
          statusFilter = {
            statusId: { in: [MOVIE_STATUS_IDS.WATCHED, MOVIE_STATUS_IDS.REWATCHED] }
          };
        }
      }

      // Получаем все теги пользователя без лимита
      const tags = await prisma.tag.findMany({
        where: {
          userId,
        },
        orderBy: {
          usageCount: 'desc'
        },
      });

      const tagIds = tags.map(t => t.id);
      
      const tagUsageCounts: Record<string, number> = {};
      
      if (tagIds.length > 0) {
        const watchListsWithTags = await prisma.watchList.findMany({
          where: {
            userId,
            tags: {
              some: {
                id: { in: tagIds }
              }
            },
            ...statusFilter
          },
          select: {
            tags: true
          }
        });

        for (const item of watchListsWithTags) {
          for (const tag of item.tags) {
            tagUsageCounts[tag.id] = (tagUsageCounts[tag.id] || 0) + 1;
          }
        }
      }

      const formattedTags = tags
        .map(tag => ({
          id: tag.id,
          name: tag.name,
          count: tagUsageCounts[tag.id] || 0,
        }))
        .filter(tag => tag.count > 0)
        .sort((a, b) => b.count - a.count);

      return { tags: formattedTags };
    };

    const result = await withCache(cacheKey, fetchTags, 1800);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching tag usage', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'TagUsageAPI'
    });
    return NextResponse.json(
      { error: 'Failed to fetch tag usage' },
      { status: 500 }
    );
  }
}