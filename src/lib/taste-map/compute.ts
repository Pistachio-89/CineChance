/**
 * TasteMap Core Computation Functions
 * 
 * Functions to compute user preference profiles from watched movies.
 */

import { prisma } from '@/lib/prisma';
import { fetchMediaDetails } from '@/lib/tmdb';
import type {
  TasteMap,
  GenreProfile,
  PersonProfiles,
  TypeProfile,
  RatingDistribution,
  BehaviorProfile,
  ComputedMetrics,
  WatchListItemFull,
} from './types';
import {
  storeTasteMap,
  storeGenreProfile,
  storePersonProfile,
  storeTypeProfile,
} from './redis';

// Completed status IDs from MovieStatus table
const COMPLETED_STATUSES = ['watched', 'completed', 'rewatched'];

/**
 * Compute genre profile from watched movies
 * Aggregates ratings by genre, returns 0-100 scale
 */
export function computeGenreProfile(watchedMovies: WatchListItemFull[]): GenreProfile {
  const genreMap = new Map<string, { totalRating: number; count: number }>();

  for (const movie of watchedMovies) {
    const rating = movie.userRating ?? movie.voteAverage;
    const genres = movie.genres || [];

    for (const genre of genres) {
      const existing = genreMap.get(genre.name) || { totalRating: 0, count: 0 };
      existing.totalRating += rating;
      existing.count += 1;
      genreMap.set(genre.name, existing);
    }
  }

  const profile: GenreProfile = {};
  for (const [genre, data] of genreMap) {
    // Scale to 0-100 (rating 0-10 → 0-100)
    profile[genre] = Math.round((data.totalRating / data.count) * 10);
  }

  return profile;
}

/**
 * Compute person profile (actors and directors) from watched movies
 * Requires TMDB credits data
 */
export function computePersonProfile(
  watchedMovies: WatchListItemFull[]
): PersonProfiles {
  const actorMap = new Map<string, { totalRating: number; count: number }>();
  const directorMap = new Map<string, { totalRating: number; count: number }>();

  for (const movie of watchedMovies) {
    const rating = movie.userRating ?? movie.voteAverage;
    const credits = movie.credits;

    if (!credits) continue;

    // Aggregate actors
    for (const actor of credits.cast || []) {
      const existing = actorMap.get(actor.name) || { totalRating: 0, count: 0 };
      existing.totalRating += rating;
      existing.count += 1;
      actorMap.set(actor.name, existing);
    }

    // Aggregate directors
    for (const crew of credits.crew || []) {
      if (crew.job === 'Director') {
        const existing = directorMap.get(crew.name) || { totalRating: 0, count: 0 };
        existing.totalRating += rating;
        existing.count += 1;
        directorMap.set(crew.name, existing);
      }
    }
  }

  // Normalize to 0-100 scale
  const actors: Record<string, number> = {};
  for (const [name, data] of actorMap) {
    actors[name] = Math.round((data.totalRating / data.count) * 10);
  }

  const directors: Record<string, number> = {};
  for (const [name, data] of directorMap) {
    directors[name] = Math.round((data.totalRating / data.count) * 10);
  }

  return { actors, directors };
}

/**
 * Compute type profile (movie vs tv) from watched movies
 * Returns percentages
 */
export function computeTypeProfile(watchedMovies: WatchListItemFull[]): TypeProfile {
  if (watchedMovies.length === 0) {
    return { movie: 0, tv: 0 };
  }

  let movieCount = 0;
  let tvCount = 0;

  for (const movie of watchedMovies) {
    if (movie.mediaType === 'movie') {
      movieCount++;
    } else {
      tvCount++;
    }
  }

  return {
    movie: Math.round((movieCount / watchedMovies.length) * 100),
    tv: Math.round((tvCount / watchedMovies.length) * 100),
  };
}

/**
 * Compute rating distribution (high/medium/low percentages)
 * High: 8-10, Medium: 5-7, Low: 1-4
 */
export function computeRatingDistribution(
  watchedMovies: WatchListItemFull[]
): RatingDistribution {
  if (watchedMovies.length === 0) {
    return { high: 0, medium: 0, low: 0 };
  }

  let high = 0;
  let medium = 0;
  let low = 0;

  for (const movie of watchedMovies) {
    const rating = movie.userRating ?? movie.voteAverage;
    if (rating >= 8) {
      high++;
    } else if (rating >= 5) {
      medium++;
    } else {
      low++;
    }
  }

  return {
    high: Math.round((high / watchedMovies.length) * 100),
    medium: Math.round((medium / watchedMovies.length) * 100),
    low: Math.round((low / watchedMovies.length) * 100),
  };
}

/**
 * Compute average rating
 */
export function computeAverageRating(watchedMovies: WatchListItemFull[]): number {
  if (watchedMovies.length === 0) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (const movie of watchedMovies) {
    if (movie.userRating !== null) {
      total += movie.userRating;
      count++;
    }
  }

  // If no user ratings, use voteAverage
  if (count === 0) {
    total = watchedMovies.reduce((sum, m) => sum + m.voteAverage, 0);
    return Math.round((total / watchedMovies.length) * 10) / 10;
  }

  return Math.round((total / count) * 10) / 10;
}

/**
 * Compute behavior profile from watch list data
 */
export async function computeBehaviorProfile(
  userId: string
): Promise<BehaviorProfile> {
  // Get all user items regardless of status
  const allItems = await prisma.watchList.findMany({
    where: { userId },
    select: {
      status: { select: { name: true } },
      watchCount: true,
    },
  });

  if (allItems.length === 0) {
    return { rewatchRate: 0, dropRate: 0, completionRate: 0 };
  }

  // Count items by status
  const statusCounts = new Map<string, number>();
  for (const item of allItems) {
    const status = item.status.name;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  const watched = statusCounts.get('watched') || 0;
  const rewatched = statusCounts.get('rewatched') || 0;
  const want = statusCounts.get('want') || 0;
  const dropped = statusCounts.get('dropped') || 0;
  const inProgress = statusCounts.get('in_progress') || 0;

  // Rewatch rate: rewatched / (watched + rewatched)
  const totalWatched = watched + rewatched;
  const rewatchRate = totalWatched > 0 
    ? Math.round((rewatched / totalWatched) * 100) 
    : 0;

  // Drop rate: dropped / (want + dropped + in_progress)
  const totalIncomplete = want + dropped + inProgress;
  const dropRate = totalIncomplete > 0 
    ? Math.round((dropped / totalIncomplete) * 100) 
    : 0;

  // Completion rate: watched / (watched + in_progress)
  const totalStarted = watched + inProgress;
  const completionRate = totalStarted > 0 
    ? Math.round((watched / totalStarted) * 100) 
    : 100;

  return { rewatchRate, dropRate, completionRate };
}

/**
 * Compute metrics from genre profile and rating distribution
 */
export function computeMetrics(
  genreProfile: GenreProfile,
  ratingDistribution: RatingDistribution
): ComputedMetrics {
  // Positive intensity: percentage of high ratings
  const positiveIntensity = ratingDistribution.high;

  // Negative intensity: percentage of low ratings
  const negativeIntensity = ratingDistribution.low;

  // Consistency: based on how centered ratings are
  // High medium % = high consistency
  const consistency = ratingDistribution.medium;

  // Diversity: number of genres with significant presence (>20)
  const genreCount = Object.values(genreProfile).filter(v => v > 20).length;
  // Scale to 0-100 (cap at 20 genres for 100%)
  const diversity = Math.min(100, genreCount * 5);

  return { positiveIntensity, negativeIntensity, consistency, diversity };
}

/**
 * Fetch TMDB credits for a list of movies
 */
async function fetchMovieCredits(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<{ cast: { id: number; name: string; character?: string }[]; crew: { id: number; name: string; job?: string }[] } | null> {
  // fetchMediaDetails appends credits but doesn't return them
  // We need to fetch credits separately or modify the function
  // For now, return null and handle in caller
  try {
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits`);
    url.searchParams.append('api_key', process.env.TMDB_API_KEY || '');
    
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      cast: data.cast?.slice(0, 20) || [], // Top 20 cast members
      crew: data.crew?.filter((c: { job: string }) => c.job === 'Director') || [],
    };
  } catch {
    return null;
  }
}

/**
 * Build complete watch list item with TMDB details
 */
async function buildWatchListItem(
  item: { tmdbId: number; mediaType: string; userRating: number | null; voteAverage: number }
): Promise<WatchListItemFull> {
  const mediaType = item.mediaType as 'movie' | 'tv';
  
  // Fetch TMDB details (includes genres)
  const details = await fetchMediaDetails(item.tmdbId, mediaType);
  
  // Fetch credits separately
  const credits = await fetchMovieCredits(item.tmdbId, mediaType);
  
  return {
    userId: '', // Not needed for computation
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    userRating: item.userRating,
    voteAverage: item.voteAverage,
    genres: details?.genres || [],
    credits: credits || undefined,
  };
}

/**
 * Main function to compute complete TasteMap for a user
 */
export async function computeTasteMap(userId: string): Promise<TasteMap> {
  // Get items from database (watched + want to watch for better coverage)
  const watchedItems = await prisma.watchList.findMany({
    where: {
      userId,
      status: {
        name: { in: [...COMPLETED_STATUSES, 'want_to_watch'] },
      },
    },
    select: {
      tmdbId: true,
      mediaType: true,
      userRating: true,
      voteAverage: true,
    },
  });

  if (watchedItems.length === 0) {
    // Return empty taste map for new users
    return {
      userId,
      genreProfile: {},
      ratingDistribution: { high: 0, medium: 0, low: 0 },
      averageRating: 0,
      personProfiles: { actors: {}, directors: {} },
      behaviorProfile: { rewatchRate: 0, dropRate: 0, completionRate: 100 },
      computedMetrics: { positiveIntensity: 0, negativeIntensity: 0, consistency: 0, diversity: 0 },
      updatedAt: new Date(),
    };
  }

  // Build full items with TMDB data
  // Limit to avoid too many API calls - batch fetch
  const itemsToFetch = watchedItems.slice(0, 50); // Limit for performance
  const watchListItems = await Promise.all(
    itemsToFetch.map(buildWatchListItem)
  );

  // Compute profiles
  const genreProfile = computeGenreProfile(watchListItems);
  const personProfiles = computePersonProfile(watchListItems);
  const typeProfile = computeTypeProfile(watchListItems);
  const ratingDistribution = computeRatingDistribution(watchListItems);
  const averageRating = computeAverageRating(watchListItems);
  const behaviorProfile = await computeBehaviorProfile(userId);
  const computedMetrics = computeMetrics(genreProfile, ratingDistribution);

  const tasteMap: TasteMap = {
    userId,
    genreProfile,
    ratingDistribution,
    averageRating,
    personProfiles,
    behaviorProfile,
    computedMetrics,
    updatedAt: new Date(),
  };

  return tasteMap;
}

/**
 * Compute and store taste map to Redis
 */
export async function recomputeTasteMap(userId: string): Promise<TasteMap> {
  const tasteMap = await computeTasteMap(userId);

  // Store to Redis
  await storeTasteMap(userId, tasteMap);
  await storeGenreProfile(userId, tasteMap.genreProfile);
  await storePersonProfile(userId, tasteMap.personProfiles);
  await storeTypeProfile(userId, {
    movie: tasteMap.ratingDistribution.high, // This is simplified
    tv: 0,
  });

  return tasteMap;
}

/**
 * Get genre profile with caching
 * Used for efficient retrieval without full taste map
 */
export async function getCachedGenreProfile(userId: string): Promise<GenreProfile> {
  const { getGenreProfile } = await import('./redis');
  
  const cached = await getGenreProfile(userId);
  if (cached) return cached;
  
  // Compute fresh
  const tasteMap = await computeTasteMap(userId);
  return tasteMap.genreProfile;
}

/**
 * Get person profile with caching
 */
export async function getCachedPersonProfile(userId: string): Promise<PersonProfiles> {
  const { getPersonProfile } = await import('./redis');
  
  const cached = await getPersonProfile(userId);
  if (cached) return cached;
  
  const tasteMap = await computeTasteMap(userId);
  return tasteMap.personProfiles;
}
