// src/app/api/auth/signup/route.ts
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/middleware/rateLimit';
import { randomUUID } from 'crypto';

// Helper to get or generate request ID
function getRequestId(headers: Headers): string {
  const existingId = headers.get('x-request-id');
  return existingId || randomUUID();
}

// Helper for consistent log format
function formatLog(requestId: string, endpoint: string, userId?: string, status?: string, message?: string): string {
  const parts = [
    `[${requestId}]`,
    endpoint,
    userId ? `user: ${userId}` : 'user: -',
    status || '-',
    message || ''
  ].filter(Boolean);
  return parts.join(' - ');
}

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  const endpoint = 'POST /api/auth/signup';
  
  const { success } = await rateLimit(req, '/api/search');
  if (!success) {
    logger.warn(formatLog(requestId, endpoint, undefined, '429', 'Rate limit exceeded'));
    return NextResponse.json(
      { error: 'Too Many Requests. Пожалуйста, подождите перед повторной попыткой.' },
      { status: 429 }
    );
  }

  try {
    const { email, password, name, birthDate, agreedToTerms, inviteToken } = await req.json();

    logger.debug(formatLog(requestId, endpoint, undefined, 'receiving', `email: ${email}, hasInviteToken: ${!!inviteToken}`));

    if (!email || !password || !birthDate) {
      logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Missing required fields'));
      return NextResponse.json(
        { error: 'Email, пароль и дата рождения обязательны' },
        { status: 400 }
      );
    }

    if (name && (name.length < 2 || name.length > 30)) {
      logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Invalid name length'));
      return NextResponse.json(
        { error: 'Никнейм должен содержать от 2 до 30 символов' },
        { status: 400 }
      );
    }

    if (!agreedToTerms) {
      logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Terms not agreed'));
      return NextResponse.json(
        { error: 'Необходимо согласиться с Пользовательским соглашением' },
        { status: 400 }
      );
    }

    // Валидация приглашения
    let invitation = null;
    if (inviteToken) {
      invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
        select: {
          id: true,
          email: true,
          usedAt: true,
          expiresAt: true,
        },
      });

      if (!invitation) {
        logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Invitation not found'));
        return NextResponse.json({ error: 'Приглашение не найдено' }, { status: 400 });
      }

      if (invitation.usedAt) {
        logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Invitation already used'));
        return NextResponse.json({ error: 'Приглашение уже использовано' }, { status: 400 });
      }

      if (invitation.expiresAt < new Date()) {
        logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Invitation expired'));
        return NextResponse.json({ error: 'Срок действия приглашения истёк' }, { status: 400 });
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        logger.warn(formatLog(requestId, endpoint, undefined, '400', 'Email mismatch with invitation'));
        return NextResponse.json(
          { error: 'Email не соответствует приглашению' },
          { status: 400 }
        );
      }
    }

    // Проверка существующего пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      logger.warn(formatLog(requestId, endpoint, undefined, '409', 'User already exists'));
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Транзакция для создания пользователя и обновления приглашения
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          hashedPassword,
          birthDate: birthDate ? new Date(birthDate) : null,
          agreedToTerms: Boolean(agreedToTerms),
          emailVerified: inviteToken ? new Date() : null,
        },
      });

      logger.info(formatLog(requestId, endpoint, newUser.id, '201', 'User created successfully'));

      // Если было приглашение, помечаем его как использованное
      if (inviteToken && invitation) {
        await tx.invitation.update({
          where: { token: inviteToken },
          data: {
            usedAt: new Date(),
            usedById: newUser.id,
          },
        });
        logger.debug(formatLog(requestId, endpoint, newUser.id, 'invitation', 'Marked as used'));
      }

      return newUser;
    });

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    logger.error(formatLog(requestId, endpoint, undefined, '500', `Error: ${error instanceof Error ? error.message : String(error)}`));

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
