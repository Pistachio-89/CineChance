// src/app/api/movie-tags/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(request: Request) {
  const req = request;
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tmdbId = parseInt(searchParams.get('tmdbId') || '0');
    const mediaType = searchParams.get('mediaType');

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ success: false, error: 'Неверные параметры' }, { status: 400 });
    }

    const userId = session.user.id as string;

    const watchListItem = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
      include: {
        tags: {
          select: {
            id: true,
            name: true,
            usageCount: true,
          },
        },
      } as any,
    });

    if (!watchListItem) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: watchListItem.tags });
  } catch (error) {
    logger.error('Error fetching movie tags', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'MovieTags'
    });
    return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 });
  }
}
