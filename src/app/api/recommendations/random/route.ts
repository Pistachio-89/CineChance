import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fetchMediaDetails } from '@/lib/tmdb';

// Константы алгоритма
const RECOMMENDATION_COOLDOWN_DAYS = 7;
const MIN_RATING_THRESHOLD = 6.5;

// Типы фильтров
type ContentType = 'movie' | 'tv' | 'anime';
type ListType = 'want' | 'watched';

interface FilterParams {
  types: ContentType[];
  lists: ListType[];
}

/**
 * Парсинг параметров фильтрации из URL
 */
function parseFilterParams(url: URL): FilterParams {
  const typesParam = url.searchParams.get('types');
  const listsParam = url.searchParams.get('lists');

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

  // Значения по умолчанию
  if (types.length === 0) types = ['movie', 'tv', 'anime'];
  if (lists.length === 0) lists = ['want'];

  return { types, lists };
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
    const { types, lists } = parseFilterParams(url);

    // 1. Получаем настройки пользователя
    const settings = await prisma.recommendationSettings.findUnique({
      where: { userId },
    });

    const preferHighRating = settings?.preferHighRating ?? true;

    // 2. Формируем условия для статусов
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
        status: {
          select: {
            name: true,
          },
        },
      },
    });

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
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          isAnime: details ? isAnime(details) : false,
          originalLanguage: details?.original_language,
          genreIds: details?.genres?.map((g: any) => g.id) || [],
        };
      } catch {
        return {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          isAnime: false,
          originalLanguage: null,
          genreIds: [],
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

    // Применяем фильтр по рейтингу
    if (preferHighRating) {
      filteredItems = filteredItems.filter((item) => item.voteAverage >= MIN_RATING_THRESHOLD);
    }

    // Если все кандидаты отфильтрованы, возвращаем сообщение
    if (filteredItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Нет доступных рекомендаций по выбранным фильтрам. Попробуйте изменить настройки.',
        movie: null,
      });
    }

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

    // Если все отфильтрованы по cooldown, возвращаем сообщение
    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Все доступные рекомендации были показаны за последнюю неделю. Попробуйте изменить фильтры.',
        movie: null,
      });
    }

    // 7. Случайный выбор
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selected = candidates[randomIndex];

    // 8. Получаем актуальные данные о фильме из TMDB
    const tmdbData = await fetchMediaDetails(selected.tmdbId, selected.mediaType as 'movie' | 'tv');

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

    // 9. Логируем показ
    const logEntry = await prisma.recommendationLog.create({
      data: {
        userId,
        tmdbId: selected.tmdbId,
        mediaType: selected.mediaType,
        algorithm: 'random_v1',
        action: 'shown',
        context: {
          source: 'recommendations_page',
          filters: {
            types,
            lists,
          },
          position: randomIndex,
          candidatesCount: candidates.length,
          userStatus,
        },
      },
    });

    // 10. Формируем ответ
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
      message: 'Рекомендация получена',
    });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { success: false, message: 'Ошибка при получении рекомендации', movie: null },
      { status: 500 }
    );
  }
}
