import { NextResponse } from "next/server";
 
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from '@/middleware/rateLimit';

export async function PUT(req: Request) {
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { name } = await req.json();

    // Валидация никнейма
    if (name && (name.length < 2 || name.length > 30)) {
      return NextResponse.json(
        { error: "Никнейм должен содержать от 2 до 30 символов" },
        { status: 400 }
      );
    }

    // Обновляем никнейм пользователя
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name || null },
    });

    return NextResponse.json(
      { 
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error updating profile', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Profile'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Получаем текущие данные пользователя
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        birthDate: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          birthDate: user.birthDate,
          createdAt: user.createdAt,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error getting profile', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Profile'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
