// src/app/search/page.tsx
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import SearchClient from './SearchClient';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || '';

  // Получаем список tmdbId из черного списка (если пользователь авторизован)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let blacklistedIds: number[] = [];

  if (userId) {
    try {
      const blacklist = await prisma.blacklist.findMany({
        where: { userId },
        select: { tmdbId: true }
      });
      blacklistedIds = blacklist.map(b => b.tmdbId);
    } catch (error) {
      console.error("Failed to fetch blacklist", error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <h1 className="text-base sm:text-lg font-medium text-white mb-4">
          {query ? `Поиск: "${query}"` : 'Поиск фильмов и сериалов'}
        </h1>

        <SearchClient initialQuery={query} blacklistedIds={blacklistedIds} />
      </div>
    </div>
  );
}
