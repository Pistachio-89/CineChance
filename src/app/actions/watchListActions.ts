// src/app/actions/watchListActions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Media } from '@/lib/tmdb';

type StatusType = 'wantToWatch' | 'watched' | 'dropped' | null;

const statusIdMap: Record<NonNullable<StatusType>, number> = {
  wantToWatch: 1,
  watched: 2,
  dropped: 3,
};

export async function toggleMediaStatus(movie: Media, newStatus: StatusType) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Не авторизован');
  }

  const userId = session.user.id as string;
  const tmdbId = movie.id;
  const mediaType = movie.media_type;

  if (newStatus === null) {
    await prisma.watchList.deleteMany({
      where: {
        userId,
        tmdbId,
        mediaType,
      },
    });
  } else {
    const statusId = statusIdMap[newStatus];

    await prisma.watchList.upsert({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      } as any,
      update: {
        statusId,
        title: movie.title || movie.name || 'Без названия',
        poster_path: movie.poster_path || null,
        voteAverage: movie.vote_average || 0,
        release_date: movie.release_date || movie.first_air_date || null,
      } as any,
      create: {
        userId,
        tmdbId,
        mediaType,
        statusId,
        title: movie.title || movie.name || 'Без названия',
        poster_path: movie.poster_path || null,
        voteAverage: movie.vote_average || 0,
        release_date: movie.release_date || movie.first_air_date || null,
      } as any,
    });
  }

  revalidatePath('/');
  revalidatePath('/search');
  revalidatePath('/my-movies');
}