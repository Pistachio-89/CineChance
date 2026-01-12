// src/app/profile/settings/page.tsx - исправленная версия
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
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
        
        <SettingsClient />
      </div>
    </div>
  );
}