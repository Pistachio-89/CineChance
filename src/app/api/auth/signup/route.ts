import { prisma } from "@/auth";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password, name, birthDate, agreedToTerms } = await req.json();

    if (!email || !password || !birthDate || !name) {
      return NextResponse.json(
        { error: "Email, пароль, никнейм и дата рождения обязательны" },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 30) {
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
    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        birthDate: birthDate ? new Date(birthDate) : null,
        agreedToTerms: Boolean(agreedToTerms),
      },
    });

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
