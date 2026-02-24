import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { calculateWeightedRating } from '@/lib/calculateWeightedRating';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

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
        example: '/api/test-weighted-rating?tmdbId=123&mediaType=movie'
      }, { status: 400 });
    }

    const result = await calculateWeightedRating(
      session.user.id,
      parseInt(tmdbId),
      mediaType
    );

    return NextResponse.json({
      success: true,
      userId: session.user.id,
      tmdbId: parseInt(tmdbId),
      mediaType,
      ...result
    });

  } catch (error) {
    logger.error('API Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
