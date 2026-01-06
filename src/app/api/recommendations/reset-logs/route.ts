import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/recommendations/reset-logs
 * Сброс истории рекомендаций для текущего пользователя
 * Удаляет все записи из RecommendationLog
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Удаляем все записи RecommendationLog для пользователя
    const deletedCount = await prisma.recommendationLog.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: `Удалено ${deletedCount.count} записей истории рекомендаций`,
    });
  } catch (error) {
    console.error('Reset logs error:', error);
    return NextResponse.json(
      { error: 'Ошибка при сбросе истории' },
      { status: 500 }
    );
  }
}
