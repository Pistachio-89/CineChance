// src/app/profile/page.tsx - старый дизайн с оптимизацией параллельной загрузки
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { redirect } from 'next/navigation';
import ProfileOverviewClient from './components/ProfileOverviewClient';

// Динамическая страница из-за персонализированных данных
export const dynamic = 'force-dynamic';

// Теги для инвалидации кэша при изменении данных пользователя
export const dynamicParams = true;

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-950 py-6 md:py-8">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">
          Профиль
        </h1>
        
        <ProfileOverviewClient userId={session.user.id} />
      </div>
    </div>
  );
}