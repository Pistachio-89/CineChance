// src/app/actions/tagsActions.ts
'use server';

import { prisma } from '@/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { revalidatePath } from 'next/cache';

// Типы для возвращаемых данных
export interface TagData {
  id: string;
  name: string;
  usageCount: number;
}

export interface MovieTagsResult {
  success: boolean;
  data?: TagData[];
  error?: string;
}

export interface UserTagsResult {
  success: boolean;
  data?: TagData[];
  error?: string;
}

// Вспомогательная функция для нормализации названия тега
function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

// Максимальное количество тегов на фильм
const MAX_TAGS_PER_MOVIE = 5;

/**
 * Создание нового тега для пользователя
 * Если тег уже существует — возвращает существующий
 */
async function upsertTag(userId: string, name: string) {
  const normalizedName = normalizeTagName(name);

  return await prisma.tag.upsert({
    where: {
      userId_name: {
        userId,
        name: normalizedName,
      },
    },
    update: {
      // Тег уже существует, просто возвращаем его
    },
    create: {
      name: normalizedName,
      userId,
      usageCount: 0,
    },
  });
}

/**
 * Получение всех тегов пользователя
 * Отсортировано по популярности (usageCount DESC), затем по имени
 */
export async function getUserTags(userId: string): Promise<UserTagsResult> {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        usageCount: true,
      },
    });

    return { success: true, data: tags };
  } catch (error) {
    console.error('Error fetching user tags:', error);
    return { success: false, error: 'Ошибка при получении тегов' };
  }
}

/**
 * Получение тегов конкретного фильма
 */
export async function getMovieTags(
  tmdbId: number,
  mediaType: string
): Promise<MovieTagsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    const watchListItem = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
      include: {
        tags: {
          select: {
            id: true,
            name: true,
            usageCount: true,
          },
        },
      } as any,
    });

    if (!watchListItem) {
      return { success: true, data: [] };
    }

    const tags: TagData[] = watchListItem.tags.map((t: any) => ({
      id: t.id,
      name: t.name,
      usageCount: t.usageCount ?? 0,
    }));

    return { success: true, data: tags };
  } catch (error) {
    console.error('Error fetching movie tags:', error);
    return { success: false, error: 'Ошибка при получении тегов фильма' };
  }
}

/**
 * Добавление тегов к фильму
 * Создаёт теги при необходимости, связывает с фильмом, обновляет счётчики
 */
export async function addTagsToMovie(
  tmdbId: number,
  mediaType: string,
  tagNames: string[]
): Promise<MovieTagsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    if (tagNames.length === 0) {
      return { success: true, data: [] };
    }

    // Проверяем существование записи в WatchList
    const watchListItem = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
    });

    if (!watchListItem) {
      return { success: false, error: 'Фильм не найден в вашем списке' };
    }

    // Проверяем текущее количество тегов
    const currentTagsCount = await prisma.tag.count({
      where: {
        watchLists: {
          some: {
            id: watchListItem.id,
          },
        },
      } as any,
    });

    const newTagsCount = tagNames.length;
    if (currentTagsCount + newTagsCount > MAX_TAGS_PER_MOVIE) {
      return {
        success: false,
        error: `Максимум ${MAX_TAGS_PER_MOVIE} тегов на фильм. Сейчас: ${currentTagsCount}, добавляем: ${newTagsCount}`,
      };
    }

    // Транзакция: создаём/находим теги и связываем с фильмом
    const result = await prisma.$transaction(async (tx) => {
      const createdTags: TagData[] = [];

      for (const tagName of tagNames) {
        // Нормализуем название
        const normalizedName = normalizeTagName(tagName);
        if (!normalizedName) continue;

        // Находим или создаём тег
        const tag = await upsertTagWithIncrement(tx, userId, normalizedName);

        // Связываем тег с фильмом (если связь ещё не существует)
        await tx.watchList.update({
          where: { id: watchListItem.id },
          data: {
            tags: {
              connect: { id: tag.id },
            },
          } as any,
        });

        createdTags.push({
          id: tag.id,
          name: tag.name,
          usageCount: tag.usageCount,
        });
      }

      return createdTags;
    });

    // Инвалидируем кэш
    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding tags to movie:', error);
    return { success: false, error: 'Ошибка при добавлении тегов' };
  }
}

/**
 * Удаление тегов с фильма
 * Обновляет счётчики, удаляет тег если usageCount стал 0
 */
export async function removeTagsFromMovie(
  tmdbId: number,
  mediaType: string,
  tagIds: string[]
): Promise<MovieTagsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    if (tagIds.length === 0) {
      return { success: true, data: [] };
    }

    // Проверяем существование записи в WatchList
    const watchListItem = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
    });

    if (!watchListItem) {
      return { success: false, error: 'Фильм не найден в вашем списке' };
    }

    // Транзакция: удаляем связи и обновляем счётчики
    await prisma.$transaction(async (tx) => {
      // Удаляем связи с фильмом
      await tx.watchList.update({
        where: { id: watchListItem.id },
        data: {
          tags: {
            disconnect: tagIds.map((id) => ({ id })),
          },
        } as any,
      });

      // Уменьшаем счётчики использования
      for (const tagId of tagIds) {
        await tx.tag.update({
          where: { id: tagId },
          data: {
            usageCount: { decrement: 1 },
          },
        });
      }

      // Удаляем теги с usageCount <= 0
      await tx.tag.deleteMany({
        where: {
          userId,
          usageCount: { lte: 0 },
        },
      });
    });

    // Инвалидируем кэш
    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true, data: [] };
  } catch (error) {
    console.error('Error removing tags from movie:', error);
    return { success: false, error: 'Ошибка при удалении тегов' };
  }
}

/**
 * Поиск тегов пользователя для автодополнения
 * Возвращает теги, начинающиеся с query, отсортированные по популярности
 */
export async function searchUserTags(
  query: string,
  limit: number = 10
): Promise<UserTagsResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;
    const normalizedQuery = normalizeTagName(query);

    const tags = await prisma.tag.findMany({
      where: {
        userId,
        name: {
          startsWith: normalizedQuery,
          mode: 'insensitive',
        },
      },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        usageCount: true,
      },
    });

    return { success: true, data: tags };
  } catch (error) {
    console.error('Error searching tags:', error);
    return { success: false, error: 'Ошибка при поиске тегов' };
  }
}

/**
 * Получение фильмов пользователя по выбранным тегам
 * Логика "ИЛИ" — показывает фильмы с хотя бы одним из выбранных тегов
 */
export async function getMoviesByTags(
  tagIds: string[],
  statusId?: number
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    const whereClause: any = {
      userId,
      tags: {
        some: {
          id: { in: tagIds },
        },
      },
    };

    if (statusId !== undefined) {
      whereClause.statusId = statusId;
    }

    const movies = await prisma.watchList.findMany({
      where: whereClause,
      include: {
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      } as any,
      orderBy: { addedAt: 'desc' },
    });

    return { success: true, data: movies };
  } catch (error) {
    console.error('Error fetching movies by tags:', error);
    return { success: false, error: 'Ошибка при получении фильмов' };
  }
}

/**
 * Получение приватной заметки к фильму
 */
export async function getMovieNote(
  tmdbId: number,
  mediaType: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    const watchListItem = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
      select: {
        note: true,
      },
    });

    return { success: true, data: watchListItem?.note || '' };
  } catch (error) {
    console.error('Error fetching movie note:', error);
    return { success: false, error: 'Ошибка при получении заметки' };
  }
}

/**
 * Обновление приватной заметки к фильму
 * Автосохранение при потере фокуса
 */
export async function updateMovieNote(
  tmdbId: number,
  mediaType: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    await prisma.watchList.update({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
      data: {
        note: note || null, // Сохраняем null вместо пустой строки
      },
    });

    // Инвалидируем кэш
    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error updating movie note:', error);
    return { success: false, error: 'Ошибка при сохранении заметки' };
  }
}

// Вспомогательная функция для upsert с инкрементом счётчика
async function upsertTagWithIncrement(tx: any, userId: string, name: string) {
  // Пытаемся найти существующий тег
  const existingTag = await tx.tag.findUnique({
    where: {
      userId_name: {
        userId,
        name,
      },
    },
  });

  if (existingTag) {
    // Тег существует — просто увеличиваем счётчик
    return await tx.tag.update({
      where: { id: existingTag.id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  } else {
    // Тег не существует — создаём новый сразу со счётчиком 1
    return await tx.tag.create({
      data: {
        name,
        userId,
        usageCount: 1,
      },
    });
  }
}
