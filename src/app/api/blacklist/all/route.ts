// src/app/api/blacklist/all/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from '@/middleware/rateLimit';

export async function GET() {
  const req = new Request('GET');
  const { success } = await rateLimit(req, '/api/user');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json([]);

    const records = await prisma.blacklist.findMany({
      where: { userId: session.user.id },
      select: { tmdbId: true }
    });

    // Исправляем тип переменной 'r' вручную для TypeScript
    return NextResponse.json(records.map((r: { tmdbId: number }) => r.tmdbId));
  } catch (error) {
    return NextResponse.json([]);
  }
}