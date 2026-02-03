import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS } from '@/lib/movieStatusConstants';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// Функция расчета улучшенной оценки актера
function calculateActorScore(actor: {
  average_rating: number | null;
  watched_movies: number;
  rewatched_movies: number;
  dropped_movies: number;
  total_movies: number;
  progress_percent: number;
}): number {
  // Базовый рейтинг
  const baseRating = actor.average_rating || 0;
  
  // QualityBonus: учитываем пересмотренные и брошенные фильмы
  const qualityBonus = Math.max(0, Math.min(10, 
    baseRating + (actor.rewatched_movies * 0.2) - (actor.dropped_movies * 0.3)
  ));
  
  // ProgressBonus: сложность поддержания рейтинга при большой фильмографии
  const progressBonus = actor.total_movies > 0 
    ? Math.log(actor.total_movies + 1) * (actor.progress_percent / 100)
    : 0;
  
  // VolumeBonus: бонус за объем фильмографии
  const volumeBonus = actor.total_movies > 0 
    ? Math.log(actor.total_movies + 1) / Math.log(200)
    : 0;
  
  // WatchedCountBonus: бонус за количество просмотренных
  const watchedCountBonus = actor.watched_movies > 0
    ? Math.log(actor.watched_movies + 1) / Math.log(50)
    : 0;
  
  // Итоговая оценка с весами
  const actorScore = 
    (qualityBonus * 0.35) + 
    (progressBonus * 0.25) + 
    (volumeBonus * 0.15) + 
    (watchedCountBonus * 0.15);
  
  return actorScore;
}

// Простое кэширование в памяти для фильмографии актеров
const actorCreditsCache = new Map<number, { data: any; timestamp: number }>();
const CACHE_DURATION = 86400000; // 24 часа в миллисекундах

// Вспомогательная функция для получения деталей с TMDB
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // 24 часа
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

// Helper function to check if movie is anime
function isAnime(movie: any): boolean {
  const hasAnimeGenre = movie.genres?.some((g: any) => g.id === 16) ?? false;
  const isJapanese = movie.original_language === 'ja';
  return hasAnimeGenre && isJapanese;
}

// Helper function to check if movie is cartoon (animation but not anime)
function isCartoon(movie: any): boolean {
  const hasAnimationGenre = movie.genres?.some((g: any) => g.id === 16) ?? false;
  const isNotJapanese = movie.original_language !== 'ja';
  return hasAnimationGenre && isNotJapanese;
}

interface TMDBMovieCredits {
  id: number;
  cast: Array<{
    id: number;
    name: string;
    profile_path: string | null;
    character: string;
  }>;
}

interface TMDBPersonCredits {
  id: number;
  cast: Array<{
    id: number;
    title: string;
    release_date: string;
    vote_count: number;
  }>;
  crew: Array<{
    id: number;
    title: string;
    release_date: string;
  }>;
}

interface ActorProgress {
  id: number;
  name: string;
  profile_path: string | null;
  watched_movies: number;
  total_movies: number;
  progress_percent: number;
  average_rating: number | null;
}

// Получение актёрского состава фильма или сериала
async function fetchMovieCredits(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<TMDBMovieCredits | null> {
  try {
    const url = new URL(`${BASE_URL}/${mediaType}/${tmdbId}/credits`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');

    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400, tags: [`${mediaType}-credits`] },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

// Получение полной фильмографии актёра с кэшированием
async function fetchPersonCredits(actorId: number): Promise<TMDBPersonCredits | null> {
  // Проверяем кэш
  const cached = actorCreditsCache.get(actorId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = new URL(`${BASE_URL}/person/${actorId}/combined_credits`);
    url.searchParams.append('api_key', TMDB_API_KEY || '');
    url.searchParams.append('language', 'ru-RU');

    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      next: { revalidate: 86400, tags: ['person-credits'] },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Сохраняем в кэш
    actorCreditsCache.set(actorId, { data, timestamp: now });
    
    return data;
  } catch (error) {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Требуется аутентификация' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || userId;
    
    // Параметры пагинации
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50); // Максимум 50
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const singleLoad = searchParams.get('singleLoad') === 'true'; // Единовременная загрузка

    // Получаем все фильмы и сериалы пользователя со статусами для анализа качества
    const [watchedMoviesData, rewatchedMoviesData, droppedMoviesData] = await Promise.all([
      // Просмотренные фильмы (без пересмотренных)
      prisma.watchList.findMany({
        where: {
          userId: targetUserId,
          statusId: MOVIE_STATUS_IDS.WATCHED,
          mediaType: { in: ['movie', 'tv'] },
        },
        select: {
          tmdbId: true,
          mediaType: true,
          userRating: true,
        },
      }),
      // Пересмотренные фильмы
      prisma.watchList.findMany({
        where: {
          userId: targetUserId,
          statusId: MOVIE_STATUS_IDS.REWATCHED,
          mediaType: { in: ['movie', 'tv'] },
        },
        select: {
          tmdbId: true,
          mediaType: true,
          userRating: true,
        },
      }),
      // Брошенные фильмы
      prisma.watchList.findMany({
        where: {
          userId: targetUserId,
          statusId: MOVIE_STATUS_IDS.DROPPED,
          mediaType: { in: ['movie', 'tv'] },
        },
        select: {
          tmdbId: true,
          mediaType: true,
          userRating: true,
        },
      }),
    ]);

    if (watchedMoviesData.length === 0 && rewatchedMoviesData.length === 0) {
      return NextResponse.json([]);
    }

    // Map для хранения актеров и их фильмов с оценками
    const actorMap = new Map<number, {
      name: string;
      profile_path: string | null;
      watchedIds: Set<number>;
      rewatchedIds: Set<number>;
      droppedIds: Set<number>;
      ratings: number[];
    }>();

    // Оптимизированная параллельная загрузка данных об актерах
    const BATCH_SIZE = 10;
    for (let i = 0; i < watchedMoviesData.length; i += BATCH_SIZE) {
      const batch = watchedMoviesData.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (movie) => {
          // Получаем детали для фильтрации мультфильмов и аниме
          const mediaDetails = await fetchMediaDetails(movie.tmdbId, movie.mediaType as 'movie' | 'tv');
          
          // Пропускаем мультфильмы и аниме
          if (mediaDetails && (isAnime(mediaDetails) || isCartoon(mediaDetails))) {
            return { credits: null, rating: movie.userRating };
          }
          
          const credits = await fetchMovieCredits(movie.tmdbId, movie.mediaType as 'movie' | 'tv');
          return { credits, rating: movie.userRating };
        })
      );

      for (const { credits, rating } of results) {
        if (credits?.cast) {
          // Берем только топ-5 актеров из фильма/сериала
          const topActors = credits.cast.slice(0, 5);
          
          for (const actor of topActors) {
            if (!actorMap.has(actor.id)) {
              actorMap.set(actor.id, {
                name: actor.name,
                profile_path: actor.profile_path,
                watchedIds: new Set(),
                rewatchedIds: new Set(),
                droppedIds: new Set(),
                ratings: [],
              });
            }
            
            actorMap.get(actor.id)!.watchedIds.add(credits.id);
            if (rating !== null && rating !== undefined) {
              actorMap.get(actor.id)!.ratings.push(rating);
            }
          }
        }
      }

      // Уменьшенная пауза между батчами
      if (i + BATCH_SIZE < watchedMoviesData.length) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Обрабатываем пересмотренные фильмы
    for (let i = 0; i < rewatchedMoviesData.length; i += BATCH_SIZE) {
      const batch = rewatchedMoviesData.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (movie) => {
          const rating = movie.userRating;
          const credits = await fetchPersonCredits(movie.tmdbId);
          
          if (credits?.cast) {
            const topActors = credits.cast.slice(0, 5);
            
            for (const actor of topActors) {
              if (actorMap.has(actor.id)) {
                actorMap.get(actor.id)!.rewatchedIds.add(credits.id);
                if (rating !== null && rating !== undefined) {
                  actorMap.get(actor.id)!.ratings.push(rating);
                }
              }
            }
          }
          
          return credits;
        })
      );

      // Уменьшенная пауза между батчами
      if (i + BATCH_SIZE < rewatchedMoviesData.length) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Обрабатываем брошенные фильмы
    for (let i = 0; i < droppedMoviesData.length; i += BATCH_SIZE) {
      const batch = droppedMoviesData.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (movie) => {
          const credits = await fetchPersonCredits(movie.tmdbId);
          
          if (credits?.cast) {
            const topActors = credits.cast.slice(0, 5);
            
            for (const actor of topActors) {
              if (actorMap.has(actor.id)) {
                actorMap.get(actor.id)!.droppedIds.add(credits.id);
                // Брошенные фильмы не влияют на средний рейтинг (это негативный фактор)
              }
            }
          }
          
          return credits;
        })
      );

      // Уменьшенная пауза между батчами
      if (i + BATCH_SIZE < droppedMoviesData.length) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Берем всех актеров для сортировки
    const allActors = Array.from(actorMap.entries())
      .sort((a, b) => b[1].watchedIds.size - a[1].watchedIds.size);
    
    // Подготавливаем базовые данные без фильмографии для всех актеров
    const baseActorsData = allActors.map(([actorId, actorData]) => ({
      id: actorId,
      name: actorData.name,
      profile_path: actorData.profile_path,
      watched_movies: actorData.watchedIds.size,
      rewatched_movies: actorData.rewatchedIds.size,
      dropped_movies: actorData.droppedIds.size,
      total_movies: 0, // Будет загружено позже
      progress_percent: 0, // Будет пересчитано позже
      average_rating: actorData.ratings.length > 0
        ? Number((actorData.ratings.reduce((a, b) => a + b, 0) / actorData.ratings.length).toFixed(1))
        : null,
    }));

    // Загружаем полную фильмографию для актеров
    if (singleLoad) {
      console.log(`Starting singleLoad for ${baseActorsData.length} actors with limit ${limit}`);
      
      // Оптимизация: обрабатываем только необходимое количество для баланса производительности
      // Для профиля (limit=20) и страницы актеров (limit=50) этого достаточно для корректной сортировки
      const maxActorsToProcess = Math.min(baseActorsData.length, limit);
      const actorsToProcess = baseActorsData.slice(0, maxActorsToProcess);
      
      console.log(`Processing ${actorsToProcess.length} actors for singleLoad (will return top ${limit})`);
      
      // Единовременная загрузка - обрабатываем актеров пачками для оптимизации
      const batchSize = 10; // Обрабатываем по 10 актеров за раз
      const achievementsPromises = [];
      
      for (let i = 0; i < actorsToProcess.length; i += batchSize) {
        const batch = actorsToProcess.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(actorsToProcess.length / batchSize)}`);
        
        const batchPromises = batch.map(async (actor) => {
          try {
            const credits = await fetchPersonCredits(actor.id);
            
            // Фильтруем мультфильмы и аниме из фильмографии актера
            let filteredCast = credits?.cast || [];
            if (filteredCast.length > 0) {
              const filteredCastDetails = await Promise.all(
                filteredCast.map(async (movie) => {
                  // Определяем тип медиа: если есть release_date - это фильм, иначе сериал
                  const mediaType = movie.release_date ? 'movie' : 'tv';
                  const mediaDetails = await fetchMediaDetails(movie.id, mediaType);
                  return {
                    movie,
                    isAnime: mediaDetails ? isAnime(mediaDetails) : false,
                    isCartoon: mediaDetails ? isCartoon(mediaDetails) : false,
                  };
                })
              );
              
              filteredCast = filteredCastDetails
                .filter(({ isAnime, isCartoon }) => !isAnime && !isCartoon)
                .map(({ movie }) => movie);
            }
            
            const totalMovies = filteredCast.length;
            const watchedMovies = actor.watched_movies;
            
            const progressPercent = totalMovies > 0 
              ? Math.round((watchedMovies / totalMovies) * 100)
              : 0;

            return {
              ...actor,
              total_movies: totalMovies,
              progress_percent: progressPercent,
            };
          } catch (error) {
            console.error(`Error processing actor ${actor.id}:`, error);
            // Возвращаем базовые данные в случае ошибки
            return {
              ...actor,
              total_movies: 0,
              progress_percent: 0,
            };
          }
        });
        
        achievementsPromises.push(Promise.all(batchPromises));
      }

      const allActorsWithFullData = (await Promise.all(achievementsPromises)).flat();
      
      // Рассчитываем улучшенную оценку для каждого актера
      const actorsWithScores = allActorsWithFullData.map(actor => ({
        ...actor,
        actor_score: calculateActorScore(actor)
      }));
      
      // Сортируем по улучшенной оценке (по убыванию)
      actorsWithScores.sort((a, b) => b.actor_score - a.actor_score);

      // Возвращаем только запрошенное количество (limit) но из правильно отсортированного списка
      const result = actorsWithScores.slice(0, limit);

      console.log(`Successfully processed ${allActorsWithFullData.length} actors, returning top ${result.length}`);

      return NextResponse.json({
        actors: result,
        hasMore: false, // При единовременной загрузке нет пагинации
        total: allActorsWithFullData.length,
        singleLoad: true,
      });
    }

    // Загружаем полную фильмографию для актеров в пределах пагинации + небольшой запас для корректной сортировки
    // Берем actors с запасом, чтобы сортировка была точной
    const actorsForProcessing = baseActorsData.slice(0, Math.min(offset + limit + 50, baseActorsData.length));
    
    const achievementsPromises = actorsForProcessing.map(async (actor) => {
      const credits = await fetchPersonCredits(actor.id);
      
      // Фильтруем мультфильмы и аниме из фильмографии актера
      let filteredCast = credits?.cast || [];
      if (filteredCast.length > 0) {
        const filteredCastDetails = await Promise.all(
          filteredCast.map(async (movie) => {
            // Определяем тип медиа: если есть release_date - это фильм, иначе сериал
            const mediaType = movie.release_date ? 'movie' : 'tv';
            const mediaDetails = await fetchMediaDetails(movie.id, mediaType);
            return {
              movie,
              isAnime: mediaDetails ? isAnime(mediaDetails) : false,
              isCartoon: mediaDetails ? isCartoon(mediaDetails) : false,
            };
          })
        );
        
        filteredCast = filteredCastDetails
          .filter(({ isAnime, isCartoon }) => !isAnime && !isCartoon)
          .map(({ movie }) => movie);
      }
      
      const totalMovies = filteredCast.length;
      const watchedMovies = actor.watched_movies;
      
      const progressPercent = totalMovies > 0 
        ? Math.round((watchedMovies / totalMovies) * 100)
        : 0;

      return {
        ...actor,
        total_movies: totalMovies,
        progress_percent: progressPercent,
      };
    });

    const actorsWithFullData = await Promise.all(achievementsPromises);
    
    // Сортируем обработанных актеров по полным данным
    actorsWithFullData.sort((a, b) => {
      if (a.average_rating !== null && b.average_rating !== null) {
        if (b.average_rating !== a.average_rating) {
          return b.average_rating - a.average_rating;
        }
      } else if (a.average_rating === null && b.average_rating !== null) {
        return 1;
      } else if (a.average_rating !== null && b.average_rating === null) {
        return -1;
      }
      
      if (b.progress_percent !== a.progress_percent) {
        return b.progress_percent - a.progress_percent;
      }
      
      return a.name.localeCompare(b.name, 'ru');
    });

    // Применяем пагинацию к отсортированным данным
    const result = actorsWithFullData.slice(offset, Math.min(offset + limit, actorsWithFullData.length));

    return NextResponse.json({
      actors: result,
      hasMore: offset + limit < baseActorsData.length, // Используем общее количество для hasMore
      total: baseActorsData.length, // Используем общее количество для total
    });

  } catch (error) {
    console.error('Ошибка при получении актеров:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
