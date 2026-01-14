import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fetchMediaDetails } from '@/lib/tmdb';
import { shouldFilterAdult } from '@/lib/age-utils';
import { logger } from '@/lib/logger';
import {
  FiltersSnapshot,
  CandidatePoolMetrics,
  TemporalContext,
  MLFeatures,
  RecommendationContext
} from '@/lib/recommendation-types';

// Константы алгоритма
const RECOMMENDATION_COOLDOWN_DAYS = 7;
const MIN_RATING_THRESHOLD = 6.5;

// Типы фильтров
type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface FilterParams {
  types: ContentType[];
  lists: ListType[];
  minRating?: number;
  maxRating?: number;
  yearFrom?: string;
  yearTo?: string;
  genres?: number[];
}

/**
 * Парсинг параметров фильтрации из URL
 */
function parseFilterParams(url: URL): FilterParams {
  const typesParam = url.searchParams.get('types');
  const listsParam = url.searchParams.get('lists');
  const minRatingParam = url.searchParams.get('minRating');
  const maxRatingParam = url.searchParams.get('maxRating');
  const yearFromParam = url.searchParams.get('yearFrom');
  const yearToParam = url.searchParams.get('yearTo');
  const genresParam = url.searchParams.get('genres');

  // Парсим типы контента
  let types: ContentType[] = [];
  if (typesParam) {
    const requestedTypes = typesParam.split(',') as ContentType[];
    // Валидируем и нормализуем
    types = requestedTypes.filter(t => ['movie', 'tv', 'anime'].includes(t));
  }

  // Парсим списки
  let lists: ListType[] = [];
  if (listsParam) {
    const requestedLists = listsParam.split(',') as ListType[];
    lists = requestedLists.filter(t => ['want', 'watched'].includes(t));
  }

  // Парсим дополнительные фильтры
  const minRating = minRatingParam ? parseInt(minRatingParam) : undefined;
  const maxRating = maxRatingParam ? parseInt(maxRatingParam) : undefined;
  const yearFrom = yearFromParam || undefined;
  const yearTo = yearToParam || undefined;
  const genres = genresParam ? genresParam.split(',').map(g => parseInt(g)).filter(g => !isNaN(g)) : undefined;

  // Значения по умолчанию
  if (types.length === 0) types = ['movie', 'tv', 'anime'];
  if (lists.length === 0) lists = ['want'];

  return { types, lists, minRating, maxRating, yearFrom, yearTo, genres };
}

/**
 * Проверка является ли фильм аниме
 */
function isAnime(tmdbData: any): boolean {
  const isAnimation = (tmdbData.genre_ids?.includes(16) || 
    tmdbData.genres?.some((g: any) => g.id === 16));
  const isJapanese = tmdbData.original_language === 'ja';
  return isAnimation && isJapanese;
}

/**
 * Получение временного контекста
 */
function getTemporalContext(): TemporalContext {
  const now = new Date();
  const hourOfDay = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  return {
    hourOfDay,
    dayOfWeek,
    isFirstSessionOfDay: false, // TODO: Заполнять из данных сессии
    sessionsLastWeek: 0, // TODO: Рассчитывать из истории
    isWeekend,
  };
}

/**
 * Расчёт метрик пула кандидатов на каждом этапе
 */
function calculateCandidatePoolMetrics(
  initialCount: number,
  afterTypeFilter: number,
  afterCooldown: number,
  afterAdditionalFilters: number,
  watchListItems: any[],
  filteredItems: any[]
): CandidatePoolMetrics {
  // Расчёт распределения рейтингов
  const ratingDistribution: Record<number, number> = {};
  const genreDistribution: Record<string, number> = {};
  
  // Статистика по рейтингам
  for (const item of watchListItems) {
    const roundedRating = Math.floor(item.voteAverage);
    ratingDistribution[roundedRating] = (ratingDistribution[roundedRating] || 0) + 1;
  }
  
  return {
    initialCount,
    afterTypeFilter,
    afterCooldown,
    afterAdditionalFilters,
    ratingDistribution,
    genreDistribution,
  };
}

/**
 * Расчёт ML-признаков (заглушки для v1, будут развиваться в v2)
 */
function calculateMLFeatures(
  userId: string,
  selectedMovie: any,
  watchListItems: any[]
): MLFeatures {
  // Базовая схожесть с ранее принятыми рекомендациями
  const similarityScore = 0.5; // TODO: Рассчитывать на основе истории
  
  // Новизна контента для пользователя
  const noveltyScore = 1.0 - (selectedMovie.addedAt ? 
    (Date.now() - new Date(selectedMovie.addedAt).getTime()) / (30 * 24 * 60 * 60 * 1000) : 0);
  
  // Разнообразие относительно предыдущих показов
  const diversityScore = 0.7; // TODO: Рассчитывать из истории
  
  // Предсказанная вероятность принятия (заглушка)
  const predictedAcceptanceProbability = 0.5;
  
  return {
    similarityScore: Math.max(0, Math.min(1, similarityScore)),
    noveltyScore: Math.max(0, Math.min(1, noveltyScore)),
    diversityScore: Math.max(0, Math.min(1, diversityScore)),
    predictedAcceptanceProbability,
    predictedRating: selectedMovie.userRating || null,
  };
}

/**
 * Создание слепка фильтров
 */
function createFiltersSnapshot(
  types: ContentType[],
  lists: ListType[],
  minRating?: number,
  maxRating?: number,
  yearFrom?: string,
  yearTo?: string,
  genres?: number[]
): FiltersSnapshot {
  return {
    contentTypes: {
      movie: types.includes('movie'),
      tv: types.includes('tv'),
      anime: types.includes('anime'),
    },
    lists: {
      want: lists.includes('want'),
      watched: lists.includes('watched'),
    },
    additionalFilters: {
      minRating,
      maxRating,
      yearFrom,
      yearTo,
      selectedGenres: genres && genres.length > 0 ? genres : undefined,
    },
  };
}

/**
 * GET /api/recommendations/random
 * Получить рекомендацию с учётом фильтров
 * 
 * Query params:
 * - types: comma-separated list of content types (movie, tv, anime)
 * - lists: comma-separated list of lists (want, watched)
 * 
 * Пример: /api/recommendations/random?types=movie,anime&lists=want,watched
 */
export async function GET(req: Request) {
  try {
    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const url = new URL(req.url);
    const { types, lists, minRating, maxRating, yearFrom, yearTo, genres } = parseFilterParams(url);

    // 1. Получаем настройки пользователя
    const settings = await prisma.recommendationSettings.findUnique({
      where: { userId },
    });

    const preferHighRating = settings?.preferHighRating ?? true;

    // 2. Получаем дату рождения пользователя для фильтрации контента
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true } as any,
    });

    // Проверяем, нужно ли фильтровать взрослый контент
    const filterAdult = shouldFilterAdult((user as any)?.birthDate ?? null, true);

    // 3. Формируем условия для статусов
    const statusConditions: string[] = [];
    if (lists.includes('want')) {
      statusConditions.push('Хочу посмотреть');
    }
    if (lists.includes('watched')) {
      statusConditions.push('Просмотрено');
      statusConditions.push('Пересмотрено');
      statusConditions.push('Брошено');
    }

    if (statusConditions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Выберите хотя бы один список',
        movie: null,
      });
    }

    // 3. Получаем фильмы из выбранных списков
    const watchListItems = await prisma.watchList.findMany({
      where: {
        userId,
        status: {
          name: { in: statusConditions },
        },
      },
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        voteAverage: true,
        addedAt: true,
        userRating: true,
        status: {
          select: {
            name: true,
          },
        },
      },
    });

    const initialCount = watchListItems.length;

    if (watchListItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Выбранные списки пусты. Добавьте фильмы в "Хочу посмотреть" или отметьте просмотренные.',
        movie: null,
      });
    }

    // 4. Получаем актуальные данные из TMDB для фильтрации по типам
    // Сначала собираем tmdbId всех фильмов из списков
    const tmdbIds = watchListItems.map(item => item.tmdbId);

    // Загружаем детали для определения типа контента (аниме/не аниме)
    const tmdbDetailsPromises = watchListItems.map(async (item) => {
      try {
        const details = await fetchMediaDetails(item.tmdbId, item.mediaType as 'movie' | 'tv');
        
        // Фильтруем взрослый контент
        if (filterAdult && details?.adult) {
          return {
            tmdbId: item.tmdbId,
            mediaType: item.mediaType,
            isAnime: false,
            originalLanguage: null,
            genreIds: [] as number[],
            release_date: null,
            first_air_date: null,
            adult: true,
          };
        }
        
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          isAnime: details ? isAnime(details) : false,
          originalLanguage: details?.original_language,
          genreIds: details?.genres?.map((g: any) => g.id) || [],
          release_date: details?.release_date || null,
          first_air_date: details?.first_air_date || null,
          adult: details?.adult || false,
        };
      } catch {
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          isAnime: false,
          originalLanguage: null,
          genreIds: [] as number[],
          release_date: null,
          first_air_date: null,
          adult: false,
        };
      }
    });

    const tmdbDetails = await Promise.all(tmdbDetailsPromises);

    // Создаём Map для быстрого доступа к деталям
    const detailsMap = new Map(tmdbDetails.map(d => [d.tmdbId, d]));

    // 5. Фильтруем по типам контента
    let filteredItems = watchListItems.filter(item => {
      const details = detailsMap.get(item.tmdbId);
      if (!details) return false;

      // Фильтруем взрослый контент
      if (filterAdult && details.adult) return false;

      const isAnimeItem = details.isAnime;
      const isMovie = item.mediaType === 'movie';
      const isTv = item.mediaType === 'tv';

      // Логика фильтрации:
      // - Если выбрано аниме, включаем все аниме (и movie, и tv)
      // - Если выбрано movie, включаем не-аниме фильмы
      // - Если выбрано tv, включаем не-аниме сериалы

      if (types.includes('anime') && isAnimeItem) {
        return true;
      }

      if (types.includes('movie') && isMovie && !isAnimeItem) {
        return true;
      }

      if (types.includes('tv') && isTv && !isAnimeItem) {
        return true;
      }

      return false;
    });

    const afterTypeFilter = filteredItems.length;

    // 6. Получаем историю показов за последние N дней (cooldown)
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - RECOMMENDATION_COOLDOWN_DAYS);

    const recentRecommendations = await prisma.recommendationLog.findMany({
      where: {
        userId,
        shownAt: { gte: cooldownDate },
      },
      select: {
        tmdbId: true,
        mediaType: true,
      },
    });

    const excludedIds = new Set(
      recentRecommendations.map((r) => `${r.tmdbId}_${r.mediaType}`)
    );

    // Применяем cooldown
    let candidates = filteredItems.filter((item) => {
      const key = `${item.tmdbId}_${item.mediaType}`;
      return !excludedIds.has(key);
    });

    const afterCooldown = candidates.length;

    // Применяем фильтр по рейтингу пользователя (дополнительный фильтр)
    // Проверяем по списку 'watched', так как рейтинг пользователя есть только у просмотренных фильмов
    if (lists.includes('watched')) {
      if (minRating !== undefined || maxRating !== undefined) {
        candidates = candidates.filter(item => {
          const rating = item.userRating ?? 0;
          if (minRating !== undefined && rating < minRating) return false;
          if (maxRating !== undefined && rating > maxRating) return false;
          return true;
        });
      }
    }

    // Применяем фильтры по году и жанрам из TMDB данных
    if (yearFrom || yearTo || (genres && genres.length > 0)) {
      candidates = candidates.filter(item => {
        const details = detailsMap.get(item.tmdbId);
        if (!details) return false;

        // Фильтр по году
        if (yearFrom || yearTo) {
          const releaseYear = parseInt((details.release_date || details.first_air_date || '').split('-')[0]);
          if (!isNaN(releaseYear)) {
            if (yearFrom && releaseYear < parseInt(yearFrom)) return false;
            if (yearTo && releaseYear > parseInt(yearTo)) return false;
          }
        }

        // Фильтр по жанрам
        if (genres && genres.length > 0) {
          const itemGenreIds = details.genreIds || [];
          const hasMatchingGenre = genres.some(g => itemGenreIds.includes(g));
          if (!hasMatchingGenre) return false;
        }

        return true;
      });
    }

    const afterAdditionalFilters = candidates.length;

    // Если все кандидаты отфильтрованы, возвращаем сообщение
    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Нет доступных рекомендаций по выбранным фильтрам. Попробуйте изменить настройки.',
        movie: null,
      });
    }

    // 7. Случайный выбор
    let randomIndex = Math.floor(Math.random() * candidates.length);
    let selected = candidates[randomIndex];

    // 7.1. Получаем полные данные о выбранном фильме из watchlist (включая рейтинг пользователя)
    let watchListData = await prisma.watchList.findFirst({
      where: {
        userId,
        tmdbId: selected.tmdbId,
        mediaType: selected.mediaType,
      },
      select: {
        id: true,
        userRating: true,
        watchCount: true,
        statusId: true,
      },
    });

    // 7.2. Получаем количество оценок пользователя для расчёта voteCount
    let ratingHistoryCount = await prisma.ratingHistory.count({
      where: {
        userId,
        tmdbId: selected.tmdbId,
        mediaType: selected.mediaType,
      },
    });

    let cineChanceRating = watchListData?.userRating || null;
    let cineChanceVoteCount = ratingHistoryCount;

    // 8. Получаем актуальные данные о фильме из TMDB
    let tmdbData = await fetchMediaDetails(selected.tmdbId, selected.mediaType as 'movie' | 'tv');

    // Проверяем взрослый контент
    if (filterAdult && tmdbData?.adult) {
      // Если выбранный фильм - взрослый контент, а пользователь младше 18
      // Исключаем его и выбираем другого кандидата
      const nonAdultCandidates = candidates.filter(c => {
        const details = detailsMap.get(c.tmdbId);
        return details && !details.adult;
      });
      
      if (nonAdultCandidates.length > 0) {
        randomIndex = Math.floor(Math.random() * nonAdultCandidates.length);
        selected = nonAdultCandidates[randomIndex];
        
        // Получаем полные данные о выбранном фильме
        watchListData = await prisma.watchList.findFirst({
          where: {
            userId,
            tmdbId: selected.tmdbId,
            mediaType: selected.mediaType,
          },
          select: {
            id: true,
            userRating: true,
            watchCount: true,
            statusId: true,
          },
        });
        
        ratingHistoryCount = await prisma.ratingHistory.count({
          where: {
            userId,
            tmdbId: selected.tmdbId,
            mediaType: selected.mediaType,
          },
        });
        
        tmdbData = await fetchMediaDetails(selected.tmdbId, selected.mediaType as 'movie' | 'tv');
        
        // Обновляем переменные
        cineChanceRating = watchListData?.userRating || null;
        cineChanceVoteCount = ratingHistoryCount;
      }
    }

    // Определяем реальный тип для отображения
    const isAnimeResult = tmdbData ? isAnime(tmdbData) : false;
    const displayMediaType = isAnimeResult ? 'anime' : (selected.mediaType === 'movie' ? 'movie' : 'tv');

    // Определяем пользовательский статус
    const userStatusMap: Record<string, string> = {
      'Хочу посмотреть': 'want',
      'Просмотрено': 'watched',
      'Пересмотрено': 'rewatched',
      'Брошено': 'dropped',
    };
    const userStatus = userStatusMap[selected.status.name] || null;

    // 9. Формируем контекстные данные для записи
    const filtersSnapshot = createFiltersSnapshot(types, lists, minRating, maxRating, yearFrom, yearTo, genres);
    const candidatePoolMetrics = calculateCandidatePoolMetrics(
      initialCount,
      afterTypeFilter,
      afterCooldown,
      afterAdditionalFilters,
      watchListItems,
      filteredItems
    );
    const temporalContext = getTemporalContext();
    const mlFeatures = calculateMLFeatures(userId, selected, watchListItems);

    const extendedContext: RecommendationContext = {
      source: 'recommendations_page',
      position: randomIndex,
      candidatesCount: candidates.length,
      userStatus,
      filtersChanged: false,
    };

    // 9. Логируем показ с расширенными данными
    const logEntry = await prisma.recommendationLog.create({
      data: {
        userId,
        tmdbId: selected.tmdbId,
        mediaType: selected.mediaType,
        algorithm: 'random_v1',
        action: 'shown',
        context: extendedContext as any,
        filtersSnapshot: filtersSnapshot as any,
        candidatePoolMetrics: candidatePoolMetrics as any,
        temporalContext: temporalContext as any,
        mlFeatures: mlFeatures as any,
      },
    });

    // 10. Обновляем счётчики в WatchList
    await prisma.watchList.update({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId: selected.tmdbId,
          mediaType: selected.mediaType,
        },
      },
      data: {
        recommendationCount: { increment: 1 },
        lastRecommendedAt: new Date(),
      },
    });

    // 11. Формируем ответ
    const movie = {
      id: selected.tmdbId,
      media_type: displayMediaType,
      title: tmdbData?.title || selected.title,
      name: tmdbData?.name || selected.title,
      poster_path: tmdbData?.poster_path || null,
      vote_average: tmdbData?.vote_average || selected.voteAverage,
      vote_count: tmdbData?.vote_count || 0,
      release_date: tmdbData?.release_date || tmdbData?.first_air_date || null,
      first_air_date: tmdbData?.first_air_date || null,
      overview: tmdbData?.overview || '',
      runtime: tmdbData?.runtime || 0,
      genres: tmdbData?.genres || [],
      original_language: tmdbData?.original_language,
    };

    return NextResponse.json({
      success: true,
      movie,
      logId: logEntry.id,
      userStatus,
      cineChanceRating,
      cineChanceVoteCount,
      userRating: watchListData?.userRating || null,
      watchCount: watchListData?.watchCount || 0,
      message: 'Рекомендация получена',
    });
  } catch (error) {
    logger.error('Recommendations API error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Recommendations'
    });
    return NextResponse.json(
      { success: false, message: 'Ошибка при получении рекомендации', movie: null },
      { status: 500 }
    );
  }
}
