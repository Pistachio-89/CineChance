// src/app/api/user/settings/route.ts
 
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from '@/middleware/rateLimit';

// GET /api/user/settings - Получить настройки пользователя
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

    // Получаем настройки рекомендаций пользователя
    const settings = await prisma.recommendationSettings.findUnique({
      where: { userId: session.user.id },
      select: {
        minRating: true,
        preferHighRating: true,
        avoidRewatches: true,
        preferUnwatched: true,
        noveltyWeight: true,
        randomnessWeight: true,
        includeWant: true,
        includeWatched: true,
        includeDropped: true,
      },
    });

    if (!settings) {
      // Если настроек нет, возвращаем значения по умолчанию
      return NextResponse.json(
        {
          success: true,
          minRating: 6.0,
          preferHighRating: true,
          avoidRewatches: false,
          preferUnwatched: true,
          noveltyWeight: 1.0,
          randomnessWeight: 1.0,
          includeWant: true,
          includeWatched: true,
          includeDropped: false,
        },
        { status: 200 }
      );
    }

    // Если minRating равен null, возвращаем 6.0 как значение по умолчанию
    return NextResponse.json(
      {
        success: true,
        minRating: settings.minRating ?? 6.0,
        preferHighRating: settings.preferHighRating,
        avoidRewatches: settings.avoidRewatches,
        preferUnwatched: settings.preferUnwatched,
        noveltyWeight: settings.noveltyWeight,
        randomnessWeight: settings.randomnessWeight,
        includeWant: settings.includeWant,
        includeWatched: settings.includeWatched,
        includeDropped: settings.includeDropped,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error getting user settings', {
      error: error instanceof Error ? error.message : String(error),
      context: 'UserSettings'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/user/settings - Обновить настройки пользователя
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

    const body = await req.json();
    const { minRating, includeWant, includeWatched, includeDropped } = body;

    // Валидация minRating
    if (minRating !== undefined) {
      if (typeof minRating !== 'number' || minRating < 1 || minRating > 10) {
        return NextResponse.json(
          { error: "minRating must be a number between 1 and 10" },
          { status: 400 }
        );
      }
    }

    // Валидация булевых полей
    if (includeWant !== undefined && typeof includeWant !== 'boolean') {
      return NextResponse.json(
        { error: "includeWant must be a boolean" },
        { status: 400 }
      );
    }
    if (includeWatched !== undefined && typeof includeWatched !== 'boolean') {
      return NextResponse.json(
        { error: "includeWatched must be a boolean" },
        { status: 400 }
      );
    }
    if (includeDropped !== undefined && typeof includeDropped !== 'boolean') {
      return NextResponse.json(
        { error: "includeDropped must be a boolean" },
        { status: 400 }
      );
    }

    // Обновляем или создаём настройки рекомендаций
    const settings = await prisma.recommendationSettings.upsert({
      where: { userId: session.user.id },
      update: {
        minRating: minRating !== undefined ? minRating : undefined,
        includeWant: includeWant !== undefined ? includeWant : undefined,
        includeWatched: includeWatched !== undefined ? includeWatched : undefined,
        includeDropped: includeDropped !== undefined ? includeDropped : undefined,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        minRating: minRating ?? 5.0,
        preferHighRating: true,
        avoidRewatches: false,
        preferUnwatched: true,
        noveltyWeight: 1.0,
        randomnessWeight: 1.0,
        includeWant: includeWant ?? true,
        includeWatched: includeWatched ?? true,
        includeDropped: includeDropped ?? false,
      },
    });

    logger.info('User settings updated', {
      userId: session.user.id,
      updatedFields: { minRating, includeWant, includeWatched, includeDropped },
      context: 'UserSettings'
    });

    return NextResponse.json(
      {
        success: true,
        minRating: settings.minRating,
        preferHighRating: settings.preferHighRating,
        avoidRewatches: settings.avoidRewatches,
        preferUnwatched: settings.preferUnwatched,
        noveltyWeight: settings.noveltyWeight,
        randomnessWeight: settings.randomnessWeight,
        includeWant: settings.includeWant,
        includeWatched: settings.includeWatched,
        includeDropped: settings.includeDropped,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error updating user settings', {
      error: error instanceof Error ? error.message : String(error),
      context: 'UserSettings'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
