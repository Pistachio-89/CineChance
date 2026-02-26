// filepath: src/lib/taste-map/actor-rating.ts
/**
 * Calculate weighted average rating for an actor/director
 * Uses SQL query on WatchList to find movies with the person
 * and calculate weighted average (accounting for watchCount/rewatches)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface ActorRatingResult {
  avgRating: number;
  count: number;
  totalRewatches: number;
}

/**
 * Get weighted average rating for a specific actor/director
 * Considers only watched/rewatched films
 * Rating is weighted by watchCount (rewatches multiply the rating)
 *
 * @param userId - User ID
 * @param personTmdbId - TMDB Person ID
 * @returns Rating info or null if person not found in user's movies
 */
export async function getActorWeightedRating(
  userId: string,
  personTmdbId: number
): Promise<ActorRatingResult | null> {
  try {
    // Query using raw SQL for performance
    // Finds all movies watched/rewatched where person appears in top-5
    const result = await prisma.$queryRaw<
      Array<{ avg_rating: number; count: number; total_rewatches: number }>
    >`
      SELECT 
        COALESCE(
          AVG(wl."userRating" * COALESCE(wl."watchCount", 1)) / 
          NULLIF(AVG(COALESCE(wl."watchCount", 1)), 0),
          0
        )::FLOAT as avg_rating,
        COUNT(DISTINCT wl."tmdbId")::INT as count,
        SUM(COALESCE(wl."watchCount", 1))::INT as total_rewatches
      FROM "WatchList" wl
      WHERE wl."userId" = ${userId}
        AND wl."statusId" IN ('watched', 'rewatched')
        AND EXISTS (
          SELECT 1 FROM "MoviePersonCache" mpc
          WHERE mpc."tmdbId" = wl."tmdbId"
            AND mpc."mediaType" = wl."mediaType"
            AND (
              mpc."topActors"::jsonb @> jsonb_build_array(
                jsonb_build_object('id', ${personTmdbId})
              )
              OR mpc."topDirectors"::jsonb @> jsonb_build_array(
                jsonb_build_object('id', ${personTmdbId})
              )
            )
        )
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      avgRating: Number(row.avg_rating ?? 0),
      count: Number(row.count ?? 0),
      totalRewatches: Number(row.total_rewatches ?? 0),
    };
  } catch (error) {
    logger.error('Error calculating actor weighted rating', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      personTmdbId,
    });
    return null;
  }
}

/**
 * Get top actors/directors by average rating
 * Groups all persons from user's movies and ranks by weighted rating
 */
export async function getTopRatedPersons(
  userId: string,
  personType: 'actor' | 'director',
  limit: number = 50
): Promise<
  Array<{
    tmdbId: number;
    name: string;
    avgRating: number;
    count: number;
  }>
> {
  try {
    const jsonField = personType === 'actor' ? 'topActors' : 'topDirectors';

    // Extract all unique persons from user's cached movies
    const personQuery = await prisma.$queryRaw<
      Array<{
        person_id: number;
        person_name: string;
        count: number;
      }>
    >`
      SELECT DISTINCT
        (person->>'id')::INT as person_id,
        person->>'name' as person_name,
        COUNT(*) as count
      FROM "MoviePersonCache" mpc,
        jsonb_array_elements(mpc."${personType === 'actor' ? 'topActors' : 'topDirectors'}") as person
      WHERE EXISTS (
        SELECT 1 FROM "WatchList" wl
        WHERE wl."userId" = ${userId}
          AND wl."statusId" IN ('watched', 'rewatched')
          AND wl."tmdbId" = mpc."tmdbId"
          AND wl."mediaType" = mpc."mediaType"
      )
      GROUP BY person_id, person_name
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    // For each person, calculate weighted rating
    const results = await Promise.all(
      personQuery.map(async (row) => {
        const rating = await getActorWeightedRating(userId, row.person_id);
        return {
          tmdbId: row.person_id,
          name: row.person_name,
          avgRating: rating?.avgRating ?? 0,
          count: rating?.count ?? 0,
        };
      })
    );

    // Sort by rating DESC
    return results.sort((a, b) => b.avgRating - a.avgRating);
  } catch (error) {
    logger.error('Error getting top rated persons', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      personType,
    });
    return [];
  }
}
