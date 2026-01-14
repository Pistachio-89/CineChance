import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);

    // Временно разрешаем доступ для всех авторизованных пользователей
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Получаем все приглашения, отсортированные по дате создания (новые first)
    const invitations = await prisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        usedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Добавляем поле isValid для удобства
    const invitationsWithValidity = invitations.map(inv => ({
      ...inv,
      isValid: !inv.usedAt && inv.expiresAt > new Date(),
    }));

    return NextResponse.json({ invitations: invitationsWithValidity });
  } catch (error) {
    logger.error("GET INVITATIONS ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
