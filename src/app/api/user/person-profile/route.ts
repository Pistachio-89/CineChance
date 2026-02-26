// filepath: src/app/api/user/person-profile/route.ts
/**
 * GET /api/user/person-profile?personType=actor|director&limit=50
 * Returns top persons (actors/directors) from PersonProfile for current user
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';
import { getUserPersonProfile } from '@/lib/taste-map/person-profile-v2';

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/user/person-profile');
  if (!success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const personType = (searchParams.get('personType') ?? 'actor') as 'actor' | 'director';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    // Get person profile from database
    const profile = await getUserPersonProfile(session.user.id, personType);

    // Slice to requested limit
    const persons = profile.slice(0, limit);

    return NextResponse.json({
      success: true,
      personType,
      persons: persons.map((p) => ({
        id: p.tmdbPersonId,
        name: p.name,
        count: p.count,
        avgWeightedRating: p.avgWeightedRating,
      })),
      total: persons.length,
    });
  } catch (error) {
    logger.error('Error fetching person profile', {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
