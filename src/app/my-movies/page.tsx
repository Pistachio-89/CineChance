// src/app/my-movies/page.tsx

import Link from 'next/link';
import { Movie } from '@/lib/tmdb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import MyMoviesClient from './MyMoviesClient';

// Заглушки
const mockMovies: Movie[] = [
  {
    id: 299536,
    title: 'Мстители: Финал',
    poster_path: '/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
    vote_average: 8.3,
    release_date: '2019-04-24',
    overview: '',
  },
  {
    id: 299534,
    title: 'Мстители: Война бесконечности',
    poster_path: '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
    vote_average: 8.3,
    release_date: '2018-04-25',
    overview: '',
  },
  {
    id: 550,
    title: 'Бойцовский клуб',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    vote_average: 8.4,
    release_date: '1999-10-15',
    overview: '',
  },
];

export default async function MyMoviesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white text-lg mb-6">
            Войдите, чтобы управлять своими списками фильмов
          </p>
          <Link href="/" className="text-blue-400 hover:underline">
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  return <MyMoviesClient initialMovies={mockMovies} />;
}
