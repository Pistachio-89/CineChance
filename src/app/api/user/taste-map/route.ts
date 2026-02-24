// src/app/api/user/taste-map/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { getTasteMap } from '@/lib/taste-map/redis';
import { computeTasteMap } from '@/lib/taste-map/compute';
import { rateLimit } from '@/middleware/rateLimit';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { success } = await rateLimit(request, '/api/user/taste-map');
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get cached taste map or compute fresh (24h cache)
    const tasteMap = await getTasteMap(userId, () => computeTasteMap(userId));

    if (!tasteMap || Object.keys(tasteMap.genreProfile).length === 0) {
      return NextResponse.json({ empty: true });
    }

    return NextResponse.json(tasteMap);
  } catch (error) {
    logger.error('Error fetching taste map', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TasteMapAPI'
    });
    return NextResponse.json(
      { error: 'Failed to fetch taste map' },
      { status: 500 }
    );
  }
}
