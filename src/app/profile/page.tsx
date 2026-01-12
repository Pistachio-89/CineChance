// src/app/profile/page.tsx - исправленная версия
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ProfileOverviewClient from './components/ProfileOverviewClient';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/');
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true,
      name: true,
      email: true,
      birthDate: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect('/');
  }

  const watchListCount = await prisma.watchList.count({
    where: { userId },
  });

  const blacklistCount = await prisma.blacklist.count({
    where: { userId },
  });

  return (
    <div className="min-h-screen bg-gray-950 py-6 md:py-8">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">
          Профиль
        </h1>
        
        <ProfileOverviewClient 
          initialUserData={{
            id: user.id,
            name: user.name,
            email: user.email,
            birthDate: user.birthDate,
            createdAt: user.createdAt,
          }}
          watchListCount={watchListCount}
          blacklistCount={blacklistCount}
        />
      </div>
    </div>
  );
}