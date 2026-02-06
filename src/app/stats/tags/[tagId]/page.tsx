// src/app/stats/tags/[tagId]/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import TagDetailClient from './TagDetailClient';
import BackButton from '@/app/stats/BackButton';

interface PageProps {
  params: Promise<{ tagId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tagId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { title: 'CineChance' };
  }

  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId: session.user.id,
    },
  });

  const tagName = tag?.name || 'Тег';
  return {
    title: `${tagName} | CineChance`,
  };
}

export default async function TagDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  const { tagId } = await params;

  // Проверяем что тег существует
  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId: session.user.id,
    },
  });

  if (!tag) {
    return (
      <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
        <div className="container mx-auto px-2 sm:px-3">
          <BackButton />
          <div className="text-center py-12">
            <p className="text-white text-lg">Тег не найден</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <BackButton />

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Тег: <span className="text-cyan-400">{tag.name}</span>
        </h1>
        <p className="text-gray-400 mb-6 md:mb-8">{tag.usageCount} фильм(ов)</p>

        <TagDetailClient userId={session.user.id} tagId={tagId} tagName={tag.name} />
      </div>
    </div>
  );
}
