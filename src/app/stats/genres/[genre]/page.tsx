// src/app/stats/genres/[genre]/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import GenreDetailClient from './GenreDetailClient';
import BackButton from '@/app/stats/BackButton';

const GENRE_MAP: Record<number, Record<string, string>> = {
  28: { name: 'Боевик', ru: 'Боевик' },
  12: { name: 'Приключение', ru: 'Приключение' },
  16: { name: 'Анимация', ru: 'Анимация' },
  35: { name: 'Комедия', ru: 'Комедия' },
  80: { name: 'Криминал', ru: 'Криминал' },
  99: { name: 'Документальный', ru: 'Документальный' },
  18: { name: 'Драма', ru: 'Драма' },
  10751: { name: 'Семейный', ru: 'Семейный' },
  14: { name: 'Фэнтези', ru: 'Фэнтези' },
  36: { name: 'История', ru: 'История' },
  27: { name: 'Ужас', ru: 'Ужас' },
  10402: { name: 'Музыка', ru: 'Музыка' },
  9648: { name: 'Мистика', ru: 'Мистика' },
  10749: { name: 'Романтика', ru: 'Романтика' },
  878: { name: 'Научная фантастика', ru: 'Научная фантастика' },
  10770: { name: 'ТВ Фильм', ru: 'ТВ Фильм' },
  53: { name: 'Триллер', ru: 'Триллер' },
  10752: { name: 'Война', ru: 'Война' },
  37: { name: 'Вестерн', ru: 'Вестерн' },
};

interface PageProps {
  params: Promise<{ genre: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { genre } = await params;
  const genreId = parseInt(genre, 10);
  const genreName = !isNaN(genreId) ? GENRE_MAP[genreId]?.ru || genre : genre;
  return {
    title: `${genreName} | CineChance`,
  };
}

export default async function GenreDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  const { genre } = await params;
  const genreId = parseInt(genre, 10);

  if (isNaN(genreId)) {
    return (
      <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
        <div className="container mx-auto px-2 sm:px-3">
          <BackButton />
          <div className="text-center py-12">
            <p className="text-white text-lg">Некорректный жанр</p>
          </div>
        </div>
      </div>
    );
  }

  const genreName = GENRE_MAP[genreId]?.ru || `Жанр ${genreId}`;

  return (
    <div className="min-h-screen bg-gray-950 py-3 sm:py-4">
      <div className="container mx-auto px-2 sm:px-3">
        <BackButton />

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">
          Жанр: <span className="text-pink-400">{genreName}</span>
        </h1>

        <GenreDetailClient userId={session.user.id} genreId={genreId} genreName={genreName} />
      </div>
    </div>
  );
}
