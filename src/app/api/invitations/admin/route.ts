import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
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
    console.error("GET INVITATIONS ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
