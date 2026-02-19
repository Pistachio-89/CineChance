// src/app/api/blacklist/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

// GET: Проверить, заблокирован ли фильм
export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/blacklist');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ isBlacklisted: false }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const tmdbId = parseInt(searchParams.get('tmdbId') || '0');
    const mediaType = searchParams.get('mediaType');

    if (!tmdbId || !mediaType) {
      return NextResponse.json({ isBlacklisted: false });
    }

    // Оптимизированный запрос - используем select
    const record = await prisma.blacklist.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId: session.user.id,
          tmdbId,
          mediaType,
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ isBlacklisted: !!record });
  } catch (error) {
    logger.error('Blacklist GET error', {
      error: error instanceof Error ? error.message : String(error),
      context: 'Blacklist',
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Добавить в черный список
export async function POST(req: Request) {
  const { success } = await rateLimit(req, '/api/blacklist');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

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

    await prisma.blacklist.create({
      data: {
        userId: session.user.id,
        tmdbId,
        mediaType,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: true });
    }
    logger.error('Blacklist POST error', {
      error: error instanceof Error ? error.message : String(error),
      context: 'Blacklist',
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Удалить из черного списка
export async function DELETE(req: Request) {
  const { success } = await rateLimit(req, '/api/blacklist');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

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

    await prisma.blacklist.deleteMany({
      where: {
        userId: session.user.id,
        tmdbId,
        mediaType,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Blacklist DELETE error', {
      error: error instanceof Error ? error.message : String(error),
      context: 'Blacklist',
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
