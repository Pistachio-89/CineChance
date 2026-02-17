// src/app/actions/tagsActions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

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

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

const MAX_TAGS_PER_MOVIE = 5;

// Получение всех тегов пользователя - оптимизировано
export async function getUserTags(userId: string): Promise<UserTagsResult> {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, usageCount: true },
    });

    return { success: true, data: tags };
  } catch (error) {
    logger.error('Error fetching user tags', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при получении тегов' };
  }
}

// Получение тегов конкретного фильма - оптимизировано
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
        userId_tmdbId_mediaType: { userId, tmdbId, mediaType },
      },
      select: {
        tags: { select: { id: true, name: true, usageCount: true } },
      },
    });

    if (!watchListItem) {
      return { success: true, data: [] };
    }

    const tags: TagData[] = watchListItem.tags.map((t) => ({
      id: t.id,
      name: t.name,
      usageCount: t.usageCount ?? 0,
    }));

    return { success: true, data: tags };
  } catch (error) {
    logger.error('Error fetching movie tags', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при получении тегов фильма' };
  }
}

// Добавление тегов к фильму - оптимизировано с транзакцией
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

    // Транзакция для атомарного добавления тегов
    const result = await prisma.$transaction(async (tx) => {
      const watchListItem = await tx.watchList.findUnique({
        where: { userId_tmdbId_mediaType: { userId, tmdbId, mediaType } },
        select: { id: true },
      });

      if (!watchListItem) {
        throw new Error('Фильм не найден в вашем списке');
      }

      const currentTagsCount = await tx.tag.count({
        where: {
          watchLists: { some: { id: watchListItem.id } },
        },
      });

      if (currentTagsCount + tagNames.length > MAX_TAGS_PER_MOVIE) {
        throw new Error(
          `Максимум ${MAX_TAGS_PER_MOVIE} тегов на фильм. Сейчас: ${currentTagsCount}, добавляем: ${tagNames.length}`
        );
      }

      const createdTags: TagData[] = [];

      for (const tagName of tagNames) {
        const normalizedName = normalizeTagName(tagName);
        if (!normalizedName) continue;

        const tag = await upsertTagWithIncrement(tx, userId, normalizedName);

        await tx.watchList.update({
          where: { id: watchListItem.id },
          data: {
            tags: { connect: { id: tag.id } },
          },
        });

        createdTags.push({
          id: tag.id,
          name: tag.name,
          usageCount: tag.usageCount,
        });
      }

      return createdTags;
    });

    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true, data: result };
  } catch (error) {
    logger.error('Error adding tags to movie', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при добавлении тегов',
    };
  }
}

// Удаление тегов с фильма - оптимизировано
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

    await prisma.$transaction(async (tx) => {
      const watchListItem = await tx.watchList.findUnique({
        where: { userId_tmdbId_mediaType: { userId, tmdbId, mediaType } },
        select: { id: true },
      });

      if (!watchListItem) {
        throw new Error('Фильм не найден в вашем списке');
      }

      await tx.watchList.update({
        where: { id: watchListItem.id },
        data: {
          tags: { disconnect: tagIds.map((id) => ({ id })) },
        },
      });

      for (const tagId of tagIds) {
        await tx.tag.update({
          where: { id: tagId },
          data: { usageCount: { decrement: 1 } },
        });
      }

      await tx.tag.deleteMany({
        where: { userId, usageCount: { lte: 0 } },
      });
    });

    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true, data: [] };
  } catch (error) {
    logger.error('Error removing tags from movie', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при удалении тегов' };
  }
}

// Поиск тегов пользователя - оптимизировано
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
        name: { startsWith: normalizedQuery, mode: 'insensitive' },
      },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: { id: true, name: true, usageCount: true },
    });

    return { success: true, data: tags };
  } catch (error) {
    logger.error('Error searching tags', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при поиске тегов' };
  }
}

// Получение фильмов по тегам - оптимизировано
export async function getMoviesByTags(
  tagIds: string[],
  statusId?: number
): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Не авторизован' };
    }

    const userId = session.user.id as string;

    const whereClause: Record<string, unknown> = {
      userId,
      tags: { some: { id: { in: tagIds } } },
    };

    if (statusId !== undefined) {
      whereClause.statusId = statusId;
    }

    const movies = await prisma.watchList.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        voteAverage: true,
        userRating: true,
        addedAt: true,
        status: { select: { name: true } },
        tags: { select: { id: true, name: true } },
      },
      orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
    });

    return { success: true, data: movies };
  } catch (error) {
    logger.error('Error fetching movies by tags', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при получении фильмов' };
  }
}

// Получение приватной заметки - оптимизировано
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
      where: { userId_tmdbId_mediaType: { userId, tmdbId, mediaType } },
      select: { note: true },
    });

    return { success: true, data: watchListItem?.note || '' };
  } catch (error) {
    logger.error('Error fetching movie note', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при получении заметки' };
  }
}

// Обновление заметки - оптимизировано
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
      where: { userId_tmdbId_mediaType: { userId, tmdbId, mediaType } },
      data: { note: note || null },
    });

    revalidatePath('/my-movies');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    logger.error('Error updating movie note', {
      error: error instanceof Error ? error.message : String(error),
      context: 'TagsActions',
    });
    return { success: false, error: 'Ошибка при сохранении заметки' };
  }
}

// Вспомогательная функция для upsert с инкрементом
async function upsertTagWithIncrement(tx: any, userId: string, name: string) {
  const existingTag = await tx.tag.findUnique({
    where: { userId_name: { userId, name } },
    select: { id: true, usageCount: true },
  });

  if (existingTag) {
    return await tx.tag.update({
      where: { id: existingTag.id },
      data: { usageCount: { increment: 1 } },
    });
  } else {
    return await tx.tag.create({
      data: { name, userId, usageCount: 1 },
    });
  }
}
