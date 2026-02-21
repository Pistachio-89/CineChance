import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/middleware/rateLimit';
import { getRecommendationStatusIds } from '@/lib/movieStatusConstants';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

// Helper to get or generate request ID
function getRequestId(headers: Headers): string {
  const existingId = headers.get('x-request-id');
  return existingId || randomUUID();
}

// Helper for consistent log format
function formatRecLog(requestId: string, endpoint: string, userId: string, action?: string, extra?: string): string {
  const parts = [
    `[${requestId}]`,
    endpoint,
    `user: ${userId}`,
    action || '-',
    extra || ''
  ].filter(Boolean);
  return parts.join(' - ');
}

/**
 * API endpoint для предварительного подсчета доступных рекомендаций
 * Возвращает статистику без выполнения TMDB запросов
 */
export async function GET(req: Request) {
  const requestId = getRequestId(req.headers);
  const endpoint = 'GET /api/recommendations/preview';
  
  // Check authentication FIRST to get userId for user-based rate limiting
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    logger.warn(formatRecLog(requestId, endpoint, '-', 'unauthorized'));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id as string;

  // Apply rate limiting with userId for per-user limits (not IP-based)
  const { success } = await rateLimit(req, '/api/recommendations', userId);
  if (!success) {
    logger.warn(formatRecLog(requestId, endpoint, userId, 'rate_limit'));
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    
    // Парсим параметры фильтров
    const typesParam = url.searchParams.get('types');
    const listsParam = url.searchParams.get('lists');
    
    // Парсим типы контента
    let types: string[] = [];
    if (typesParam) {
      types = typesParam.split(',').filter(t => ['movie', 'tv', 'anime'].includes(t));
    }

    // Парсим списки
    let lists: string[] = [];
    if (listsParam) {
      lists = listsParam.split(',').filter(t => ['want', 'watched', 'dropped'].includes(t));
    }

    // Получаем ID статусов
    const statusIds = getRecommendationStatusIds(lists);
    
    logger.info(formatRecLog(requestId, endpoint, userId, 'request', `types: ${types.join(',')}, lists: ${lists.join(',')}`));

    if (statusIds.length === 0) {
      logger.warn(formatRecLog(requestId, endpoint, userId, 'no_status'));
      return NextResponse.json({
        success: false,
        message: 'Выберите хотя бы один список',
        stats: null
      });
    }

    // Получаем количество фильмов по статусам
    const totalItems = await prisma.watchList.count({
      where: {
        userId,
        statusId: { in: statusIds },
      },
    });

    if (totalItems === 0) {
      logger.info(formatRecLog(requestId, endpoint, userId, 'empty_list'));
      return NextResponse.json({
        success: true,
        stats: {
          totalItems: 0,
          availableCount: 0,
          isSmallLibrary: true,
          suggestions: {
            addMoreMovies: true,
            expandTypes: types.length > 0 && types.length < 3,
            includeOtherLists: lists.length > 0 && lists.length < 3
          }
        },
        message: 'Выбранные списки пусты. Добавьте фильмы в список "Хочу посмотреть", отметьте просмотренные или брошенные.'
      });
    }

    // Для малого количества (< 10) считаем что все будут доступны
    // Для большого количества делаем оценку на основе статистики
    let estimatedAvailable = totalItems;
    
    if (totalItems > 10) {
      // Оценка: примерно 70% фильмов проходят базовую фильтрацию
      estimatedAvailable = Math.floor(totalItems * 0.7);
      
      // Если указаны типы контента, учитываем это
      if (types.length > 0) {
        const typeRatio = types.length / 3; // 3 типа всего: movie, tv, anime
        estimatedAvailable = Math.floor(estimatedAvailable * typeRatio);
      }
    }

    logger.info(formatRecLog(requestId, endpoint, userId, 'success', `total: ${totalItems}, estimated: ${estimatedAvailable}`));

    // Формируем предложения
    const suggestions = {
      addMoreMovies: totalItems <= 5,
      expandTypes: types.length > 0 && types.length < 3,
      includeOtherLists: lists.length > 0 && lists.length < 3
    };

    // Формируем сообщение
    let message = '';
    if (totalItems <= 3) {
      message = `У вас всего ${totalItems} фильм(ов) в списке. Для разнообразия рекомендаций добавьте больше фильмов!`;
    } else if (totalItems <= 10) {
      message = `У вас ${totalItems} фильмов в списке. Хотите больше разнообразия? Попробуйте включить другие типы контента или списки.`;
    } else {
      message = `Доступно примерно ${estimatedAvailable} рекомендаций из ${totalItems} фильмов.`;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalItems,
        availableCount: estimatedAvailable,
        isSmallLibrary: totalItems <= 10,
        suggestions
      },
      message
    });

  } catch (error) {
    logger.error(formatRecLog(requestId, endpoint, '-', 'error', `Error: ${error instanceof Error ? error.message : String(error)}`));
    return NextResponse.json({
      success: false,
      message: 'Ошибка при получении статистики',
      stats: null
    });
  }
}
