// src/app/page.tsx
import HorizontalMovieGridServer from './components/HorizontalMovieGridServer';
import RecommendationsGrid from './components/RecommendationsGrid';
import { Suspense } from 'react';
import LoaderSkeleton from './components/LoaderSkeleton';
import { revalidate } from '@/lib/cache';

export const revalidateTime = revalidate(3600); // ISR: обновление страницы раз в час (3600 секунд)

// Теги для инвалидации кэша
export const cacheTagsList = ['trending-movies', 'home-page'];

export default async function Home() {
  return (
    <div className="w-full max-w-full">
      <Suspense fallback={
        <div className="w-full">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 mt-4">Популярное на этой неделе</h1>
          <LoaderSkeleton variant="full" text="Загрузка..." />
        </div>
      }>
        <HorizontalMovieGridServer />
      </Suspense>
      
      <Suspense fallback={
        <div className="mt-12 px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">Рекомендации для вас</h2>
          <LoaderSkeleton variant="full" text="Загрузка рекомендаций..." />
        </div>
      }>
        <div className="mt-12 px-4 sm:px-6 lg:px-8">
          <RecommendationsGrid />
        </div>
      </Suspense>
      
      <div className="h-12"></div>
    </div>
  );
}