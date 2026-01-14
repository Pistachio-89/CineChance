import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import crypto from "crypto";

// Срок действия приглашения по умолчанию - 7 дней
const INVITE_EXPIRY_DAYS = 7;

// Генерация уникального токена
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email обязателен" },
        { status: 400 }
      );
    }

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Проверяем, нет ли уже активного приглашения на этот email
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "Приглашение на этот email уже отправлено" },
        { status: 409 }
      );
    }

    // Создаём приглашение
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        token,
        expiresAt,
        createdById: session.user.id,
      },
    });

    // Формируем ссылку для приглашения
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    // Получаем имя отправителя для включения в письмо
    const inviterName = session.user.name || session.user.email || 'Пользователь';

    // Отправляем email с приглашением
    const emailSent = await sendInviteEmail({
      to: email,
      inviteLink,
      inviterName,
    });

    if (!emailSent) {
      logger.warn(`[INVITE] Email не отправлен для ${email}, но приглашение создано`);
    }

    logger.info('Created invite', { email, inviteLink, emailSent, context: 'Invitations' });

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          inviteLink,
          emailSent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating invite', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Invitations'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const action = searchParams.get("action");

    if (!token) {
      return NextResponse.json(
        { error: "Token обязателен" },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    // Проверка действия
    if (action === "verify") {
      // Просто проверка валидности
      if (invitation.usedAt) {
        return NextResponse.json(
          { 
            valid: false,
            error: "Приглашение уже использовано",
          },
          { status: 400 }
        );
      }

      if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
          { 
            valid: false,
            error: "Срок действия приглашения истёк",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        valid: true,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      });
    }

    if (action === "info") {
      // Полная информация о приглашении
      return NextResponse.json({
        email: invitation.email,
        createdBy: invitation.createdBy?.name || invitation.createdBy?.email,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        usedAt: invitation.usedAt,
        isValid: !invitation.usedAt && invitation.expiresAt > new Date(),
      });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error getting invite', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Invitations'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
