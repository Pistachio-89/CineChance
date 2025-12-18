// src/app/page.tsx
import MovieGridServer from './components/MovieGridServer';

export default function Home() {
  return (
    <div className="w-full max-w-full">
      <MovieGridServer />
      <div className="h-8 sm:h-12"></div>
    </div>
  );
}