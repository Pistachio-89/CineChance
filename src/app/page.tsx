// src/app/page.tsx
import HorizontalMovieGridServer from './components/HorizontalMovieGridServer';
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
          <LoaderSkeleton variant="full" text="Загрузка..." />
        </div>
      }>
        <HorizontalMovieGridServer />
      </Suspense>
      
      <Suspense fallback={
        <div className="w-full">
          <LoaderSkeleton variant="full" text="Загрузка..." />
        </div>
      }>
        <HorizontalMovieGridServer title="Рекомендации для вас" />
      </Suspense>
      
      <div className="h-12"></div>
    </div>
  );
}