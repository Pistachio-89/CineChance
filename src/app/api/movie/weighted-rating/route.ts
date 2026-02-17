import { NextRequest, NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { calculateWeightedRating } from '@/lib/calculateWeightedRating';
import { logger } from '@/lib/logger';

// Кэш для хранения результатов на 1 час
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 час

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get('tmdbId');
    const mediaType = searchParams.get('mediaType') || 'movie';

    if (!tmdbId) {
      return NextResponse.json({ 
        error: 'Missing tmdbId parameter',
        example: '/api/movie/weighted-rating?tmdbId=123&mediaType=movie'
      }, { status: 400 });
    }

    // Проверяем кэш
    const cacheKey = `${session.user.id}-${tmdbId}-${mediaType}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // Расчитываем взвешенную оценку
    const result = await calculateWeightedRating(
      session.user.id,
      parseInt(tmdbId),
      mediaType
    );

    const response = {
      success: true,
      userId: session.user.id,
      tmdbId: parseInt(tmdbId),
      mediaType,
      ...result,
      cached: false
    };

    // Сохраняем в кэш
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Weighted Rating API Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Очистка кэша при POST запросе
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get('tmdbId');
    const mediaType = searchParams.get('mediaType') || 'movie';

    if (!tmdbId) {
      return NextResponse.json({ error: 'Missing tmdbId parameter' }, { status: 400 });
    }

    // Очищаем кэш для конкретного фильма
    const cacheKey = `${session.user.id}-${tmdbId}-${mediaType}`;
    cache.delete(cacheKey);

    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared',
      tmdbId: parseInt(tmdbId),
      mediaType
    });

  } catch (error) {
    logger.error('Cache Clear Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
