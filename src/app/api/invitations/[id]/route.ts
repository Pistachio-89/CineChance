import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from '@/middleware/rateLimit';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Проверяем, что приглашение существует
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    // Удаляем приглашение
    await prisma.invitation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE INVITATION ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
