// src/app/stats/ratings/[rating]/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import RatingDetailClient from './RatingDetailClient';
import BackButton from '@/app/stats/BackButton';

interface PageProps {
  params: Promise<{ rating: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { rating } = await params;
  return {
    title: `Фильмы с оценкой ${rating} | CineChance`,
  };
}

export default async function RatingDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  const { rating } = await params;
  const ratingNum = parseInt(rating, 10);

  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
    return (
      <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
        <div className="container mx-auto px-2 sm:px-3">
          <BackButton />
          <div className="text-center py-12">
            <p className="text-white text-lg">Некорректная оценка. Доступные оценки: 1-10</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <BackButton />

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">
          Фильмы с оценкой {ratingNum}
        </h1>

        <RatingDetailClient userId={session.user.id} rating={ratingNum} />
      </div>
    </div>
  );
}
