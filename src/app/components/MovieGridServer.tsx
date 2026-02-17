// src/app/components/MovieGridServer.tsx
 
import LazyMovieCard from './LazyMovieCard';
import { fetchTrendingMovies } from '@/lib/tmdb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isUnder18 } from '@/lib/age-utils';
import { logger } from '@/lib/logger';
import { AppErrorBoundary } from './ErrorBoundary';

export default async function MovieGridServer() {
  try {
    // Получаем сессию пользователя для проверки возраста и blacklist
    const session = await getServerSession(authOptions);
    let shouldFilterAdult = false;
    let blacklistedIds: Set<number> = new Set();

    // Проверяем возраст пользователя, если он авторизован
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { birthDate: true },
      });

      if (user?.birthDate) {
        shouldFilterAdult = isUnder18(user.birthDate);
      }

      // Получаем blacklist пользователя
      const blacklist = await prisma.blacklist.findMany({
        where: { userId: session.user.id as string },
        select: { tmdbId: true }
      });
      blacklistedIds = new Set(blacklist.map(b => b.tmdbId));
    }

    const movies = await fetchTrendingMovies('week');
    
    // Фильтруем взрослый контент для несовершеннолетних
    const filteredMovies = shouldFilterAdult 
      ? movies.filter(movie => !movie.adult)
      : movies;
    
    const displayMovies = filteredMovies.slice(0, 28);

    if (displayMovies.length === 0) {
      return (
        <div className="w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Не удалось загрузить фильмы. Попробуйте позже.</p>
          </div>
        </div>
      );
    }

    return (
      <AppErrorBoundary
        fallback={
          <div className="w-full">
            <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
            <div className="border-2 border-red-500/50 rounded-lg p-8 text-center">
              <p className="text-red-400 text-lg mb-4">Ошибка загрузки фильмов</p>
              <p className="text-gray-500 text-sm">Пожалуйста, обновите страницу</p>
            </div>
          </div>
        }
      >
        <div className="w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-6">
            {displayMovies.map((movie, index) => (
              <LazyMovieCard 
                key={movie.id} 
                movie={movie} 
                index={index}
                priority={index < 6}
              />
            ))}
          </div>
        </div>
      </AppErrorBoundary>
    );
  } catch (error) {
    logger.error('Error in MovieGridServer', { error });
    return (
      <div className="w-full">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 mt-4">Популярное на этой неделе</h1>
        <div className="text-center py-12">
          <p className="red-400 text-lg">Ошибка при загрузке фильмов</p>
        </div>
      </div>
    );
  }
}
