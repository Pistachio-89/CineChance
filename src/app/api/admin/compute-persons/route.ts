// filepath: src/app/api/admin/compute-persons/route.ts
/**
 * Admin endpoint for computing person profiles
 * POST - Trigger full computation
 * GET - Return statistics
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { computeAllPersonProfiles } from '@/lib/tasks/computePersonProfiles';
import { getPersonProfileStats } from '@/lib/taste-map/person-profile-v2';
import { logger } from '@/lib/logger';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'cmkbc7sn2000104k3xd3zyf2a';

/**
 * POST /api/admin/compute-persons
 * Trigger computation of person profiles
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id !== ADMIN_USER_ID) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { limit = 50, offset = 0 } = await request.json();

    logger.info('Admin triggered person profiles computation', {
      limit,
      offset,
      adminId: session.user.id,
    });

    const result = await computeAllPersonProfiles({
      limit: Math.min(Math.max(limit, 1), 500),
      offset: Math.max(offset, 0),
    });

    return NextResponse.json({
      success: true,
      message: `Computed person profiles for ${result.processed} users (${result.computed} profiles total)`,
      stats: {
        processed: result.processed,
        computed: result.computed,
        errors: result.errors.length,
        errorsList: result.errors.slice(0, 10), // Limit displayed errors
        duration: result.duration,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error in compute persons endpoint', {
      error: errorMsg,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/compute-persons
 * Return person profiles statistics
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id !== ADMIN_USER_ID) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  try {
    const stats = await getPersonProfileStats();

    return NextResponse.json({
      success: true,
      stats: {
        totalProfiles: stats.totalProfiles,
        byPersonType: stats.byPersonType,
        avgPersonsPerProfile: stats.avgPersonsPerProfile.toFixed(2),
        lastComputedAt: stats.lastComputedAt,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error in compute persons stats endpoint', {
      error: errorMsg,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}
