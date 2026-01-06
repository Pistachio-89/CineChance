import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import RecommendationsClient from './RecommendationsClient';

export default async function RecommendationsPage() {
  // Проверяем сессию на сервере
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  return <RecommendationsClient userId={session.user.id} />;
}
