import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, name, birthDate, agreedToTerms, inviteToken } = await req.json();

    console.log('[SIGNUP] Request received:', { 
      email, 
      hasInviteToken: !!inviteToken,
      inviteToken: inviteToken ? inviteToken.substring(0, 20) + '...' : null 
    });

    if (!email || !password || !birthDate) {
      return NextResponse.json(
        { error: "Email, пароль и дата рождения обязательны" },
        { status: 400 }
      );
    }

    // Проверка никнейма, если он указан
    if (name && (name.length < 2 || name.length > 30)) {
      return NextResponse.json(
        { error: "Никнейм должен содержать от 2 до 30 символов" },
        { status: 400 }
      );
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { error: "Необходимо согласиться с Пользовательским соглашением" },
        { status: 400 }
      );
    }

    // Валидация приглашения, если токен предоставлен
    let invitation = null;
    if (inviteToken) {
      console.log('[SIGNUP] Looking up invitation with token...');
      invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
      });
      console.log('[SIGNUP] Invitation found:', invitation ? { 
        id: invitation.id, 
        email: invitation.email, 
        usedAt: invitation.usedAt,
        expiresAt: invitation.expiresAt 
      } : 'NOT FOUND');

      if (!invitation) {
        return NextResponse.json(
          { error: "Приглашение не найдено" },
          { status: 400 }
        );
      }

      if (invitation.usedAt) {
        return NextResponse.json(
          { error: "Приглашение уже использовано" },
          { status: 400 }
        );
      }

      if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Срок действия приглашения истёк" },
          { status: 400 }
        );
      }

      // Проверяем, что email совпадает с приглашением
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        console.log('[SIGNUP] Email mismatch:', { 
          invitationEmail: invitation.email, 
          submittedEmail: email 
        });
        return NextResponse.json(
          { error: "Email не соответствует приглашению" },
          { status: 400 }
        );
      }
      
      console.log('[SIGNUP] Invitation validation passed, proceeding to create user');
    }

    // 1️⃣ Проверка существующего пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 } // Conflict
      );
    }

    // 2️⃣ Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Создаём пользователя
    console.log('[SIGNUP] Creating user...');
    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        birthDate: birthDate ? new Date(birthDate) : null,
        agreedToTerms: Boolean(agreedToTerms),
        // При регистрации через приглашение email считается подтверждённым
        emailVerified: inviteToken ? new Date() : null,
      },
    });
    console.log('[SIGNUP] User created:', { userId: user.id, email: user.email });

    // 4️⃣ Если было приглашение, помечаем его как использованное
    if (inviteToken && invitation) {
      console.log('[SIGNUP] Marking invitation as used...');
      const updated = await prisma.invitation.update({
        where: { token: inviteToken },
        data: {
          usedAt: new Date(),
          usedById: user.id,
        },
      });
      console.log('[SIGNUP] Invitation marked as used:', { 
        invitationId: updated.id, 
        usedAt: updated.usedAt,
        usedById: updated.usedById 
      });
    }

    return NextResponse.json(
      { id: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
