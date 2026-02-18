import { NextResponse } from 'next/server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Получаем все статусы из базы данных
    const statuses = await prisma.$queryRaw`
      SELECT id, name 
      FROM "MovieStatus" 
      ORDER BY id
    `;

    logger.debug('Real statuses in database', { statuses });

    // Считаем количество записей по каждому реальному статусу
    const counts = await Promise.all(
      (statuses as unknown[]).map(async (status: any) => {
        const count = await prisma.watchList.count({
          where: {
            userId: session.user.id,
            statusId: status.id
          }
        });
        return {
          id: status.id,
          name: status.name,
          count
        };
      })
    );

    // Также считаем blacklist
    const blacklistCount = await prisma.blacklist.count({
      where: { userId: session.user.id }
    });

    // Получаем несколько записей для каждого статуса
    const sampleRecords = await Promise.all(
      (statuses as unknown[]).map(async (status: any) => {
        const records = await prisma.watchList.findMany({
          where: {
            userId: session.user.id,
            statusId: status.id
          },
          select: {
            id: true,
            tmdbId: true,
            mediaType: true,
            title: true,
            statusId: true,
            addedAt: true
          },
          take: 3,
          orderBy: [{ addedAt: 'desc' }, { id: 'desc' }]
        });
        return {
          statusId: status.id,
          statusName: status.name,
          records: records.map(r => ({
            ...r,
            addedAt: r.addedAt.toISOString()
          }))
        };
      })
    );

    return NextResponse.json({
      realStatuses: statuses,
      counts,
      blacklistCount,
      sampleRecords,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error checking real status IDs', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to check status IDs', details: error.message }, 
      { status: 500 }
    );
  }
}
