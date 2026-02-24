/**
 * TasteMap Similarity Calculation
 * 
 * Functions for computing similarity between user taste maps.
 * Uses cosine similarity for genre vectors, Pearson correlation for ratings,
 * and Jaccard similarity for person overlap.
 */

import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { GenreProfile, PersonProfiles } from './types';
import { getTasteMap } from './redis';

// TTL: 24 hours in seconds
export const TTL_24H = 86400;

// Weights for overall match from CONTEXT.md
const WEIGHTS = {
  tasteSimilarity: 0.5,
  ratingCorrelation: 0.3,
  personOverlap: 0.2,
};

// Similarity threshold from CONTEXT.md
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Result of similarity calculation between two users
 */
export interface SimilarityResult {
  tasteSimilarity: number;     // Cosine similarity (0-1)
  ratingCorrelation: number;   // Pearson correlation (-1 to 1)
  personOverlap: number;        // Jaccard similarity (0-1)
  overallMatch: number;        // Weighted sum (0-1)
}

/**
 * Similar user with match score
 */
export interface SimilarUser {
  userId: string;
  overallMatch: number;
}

/**
 * Normalize two genre profiles to the same genre set
 * Returns arrays aligned to the same genre keys
 */
export function normalizeVectors(
  profileA: GenreProfile,
  profileB: GenreProfile
): [number[], number[], string[]] {
  // Get all unique genres from both profiles
  const allGenres = new Set([
    ...Object.keys(profileA),
    ...Object.keys(profileB),
  ]);
  
  const genreList = Array.from(allGenres);
  
  // Create vectors with 0 for missing genres
  const vecA = genreList.map(genre => profileA[genre] || 0);
  const vecB = genreList.map(genre => profileB[genre] || 0);
  
  return [vecA, vecB, genreList];
}

/**
 * Compute cosine similarity between two genre profiles
 * Returns value between 0 and 1 (1 = identical profiles)
 * 
 * Formula: cos(A, B) = (A · B) / (||A|| × ||B||)
 */
export function cosineSimilarity(
  profileA: GenreProfile,
  profileB: GenreProfile
): number {
  // Handle empty profiles
  if (Object.keys(profileA).length === 0 && Object.keys(profileB).length === 0) {
    return 0;
  }
  
  // Normalize vectors to same genre set
  const [vecA, vecB] = normalizeVectors(profileA, profileB);
  
  // Compute dot product
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  
  // Compute magnitudes
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  // Handle division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Compute Pearson correlation coefficient between two rating arrays
 * Returns value between -1 and 1
 * - 1 = perfect positive correlation
 * - 0 = no correlation
 * - -1 = perfect negative correlation
 * 
 * Requires both arrays to have same length and at least 2 data points
 */
export function ratingCorrelation(
  ratingsA: number[],
  ratingsB: number[]
): number {
  // Handle insufficient data
  if (ratingsA.length < 2 || ratingsB.length !== ratingsA.length) {
    return 0;
  }
  
  // Calculate means
  const n = ratingsA.length;
  const meanA = ratingsA.reduce((a, b) => a + b, 0) / n;
  const meanB = ratingsB.reduce((a, b) => a + b, 0) / n;
  
  // Calculate Pearson correlation
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  
  for (let i = 0; i < n; i++) {
    const diffA = ratingsA[i] - meanA;
    const diffB = ratingsB[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }
  
  // Handle division by zero (all ratings are the same)
  const denominator = Math.sqrt(denomA * denomB);
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * Compute Jaccard similarity between two person profiles
 * Returns value between 0 and 1 (1 = identical favorite persons)
 * 
 * Jaccard = |intersection| / |union|
 */
export function personOverlap(
  personsA: Record<string, number>,
  personsB: Record<string, number>
): number {
  // Get sets of person names (non-zero means favorite)
  const entriesA = Object.entries(personsA).filter(([, score]) => score > 0);
  const entriesB = Object.entries(personsB).filter(([, score]) => score > 0);
  
  const setA = new Set(entriesA.map(([name]) => name));
  const setB = new Set(entriesB.map(([name]) => name));
  
  // Handle empty profiles
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }
  
  // Calculate intersection and union
  const intersectionSize = entriesA.filter(([name]) => setB.has(name)).length;
  const unionSize = setA.size + setB.size - intersectionSize;
  
  return intersectionSize / unionSize;
}

/**
 * Compute overall match score from similarity result
 * Uses weights from CONTEXT.md: tasteSimilarity: 0.5, ratingCorrelation: 0.3, personOverlap: 0.2
 * Note: ratingCorrelation is normalized from [-1, 1] to [0, 1] for weighting
 */
export function computeOverallMatch(result: SimilarityResult): number {
  // Normalize rating correlation from [-1, 1] to [0, 1]
  const normalizedCorrelation = (result.ratingCorrelation + 1) / 2;
  
  return (
    result.tasteSimilarity * WEIGHTS.tasteSimilarity +
    normalizedCorrelation * WEIGHTS.ratingCorrelation +
    result.personOverlap * WEIGHTS.personOverlap
  );
}

/**
 * Check if two users are similar based on similarity threshold
 * Returns true if tasteSimilarity > 0.7 (threshold from CONTEXT.md)
 */
export function isSimilar(result: SimilarityResult): boolean {
  return result.tasteSimilarity > SIMILARITY_THRESHOLD;
}

// Redis key patterns for similarity data
const SIMILAR_KEYS = {
  similarUsers: (userId: string) => `similar-users:${userId}`,
  similarityPair: (userId: string, otherUserId: string) => `similarity:${userId}:${otherUserId}`,
};

/**
 * Store similar users list to Redis
 */
export async function storeSimilarUsers(
  userId: string,
  similarUsers: SimilarUser[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  try {
    await redis.set(
      SIMILAR_KEYS.similarUsers(userId),
      JSON.stringify(similarUsers),
      { ex: TTL_24H }
    );
  } catch (error) {
    logger.error('Failed to store similar users', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      context: 'SimilarityRedis'
    });
  }
}

/**
 * Get similar users from Redis
 */
export async function getSimilarUsers(userId: string): Promise<SimilarUser[]> {
  const redis = getRedis();
  if (!redis) return [];
  
  try {
    const cached = await redis.get<string>(SIMILAR_KEYS.similarUsers(userId));
    if (cached) {
      return JSON.parse(cached) as SimilarUser[];
    }
  } catch (error) {
    logger.error('Failed to get similar users', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      context: 'SimilarityRedis'
    });
  }
  
  return [];
}

/**
 * Store similarity score for a user pair
 */
export async function storeSimilarityPair(
  userId: string,
  otherUserId: string,
  score: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  try {
    await redis.set(
      SIMILAR_KEYS.similarityPair(userId, otherUserId),
      JSON.stringify(score),
      { ex: TTL_24H }
    );
  } catch (error) {
    logger.error('Failed to store similarity pair', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      otherUserId,
      context: 'SimilarityRedis'
    });
  }
}

/**
 * Get similarity score for a user pair
 */
export async function getSimilarityPair(
  userId: string,
  otherUserId: string
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  try {
    const cached = await redis.get<string>(SIMILAR_KEYS.similarityPair(userId, otherUserId));
    if (cached) {
      return JSON.parse(cached) as number;
    }
  } catch (error) {
    logger.error('Failed to get similarity pair', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      otherUserId,
      context: 'SimilarityRedis'
    });
  }
  
  return null;
}

/**
 * Compute similarity between two users
 * Returns full SimilarityResult
 */
export async function computeSimilarity(
  userIdA: string,
  userIdB: string
): Promise<SimilarityResult> {
  // Get taste maps from cache (or compute fresh)
  const [tasteMapA, tasteMapB] = await Promise.all([
    getTasteMap(userIdA),
    getTasteMap(userIdB),
  ]);
  
  // Handle missing profiles
  if (!tasteMapA || !tasteMapB) {
    return {
      tasteSimilarity: 0,
      ratingCorrelation: 0,
      personOverlap: 0,
      overallMatch: 0,
    };
  }
  
  // Compute taste similarity (cosine similarity of genre vectors)
  const tasteSimilarity = cosineSimilarity(
    tasteMapA.genreProfile,
    tasteMapB.genreProfile
  );
  
  // Compute person overlap (Jaccard similarity of actors and directors)
  const actorsOverlap = personOverlap(
    tasteMapA.personProfiles.actors,
    tasteMapB.personProfiles.actors
  );
  const directorsOverlap = personOverlap(
    tasteMapA.personProfiles.directors,
    tasteMapB.personProfiles.directors
  );
  // Average of actor and director overlap
  const personOverlapValue = (actorsOverlap + directorsOverlap) / 2;
  
  // For rating correlation, we'd need shared movie ratings
  // For now, set to 0 (would need RatingHistory data to compute properly)
  const ratingCorrelationValue = 0;
  
  const result: SimilarityResult = {
    tasteSimilarity,
    ratingCorrelation: ratingCorrelationValue,
    personOverlap: personOverlapValue,
    overallMatch: 0, // Will be computed below
  };
  
  // Compute overall match
  result.overallMatch = computeOverallMatch(result);
  
  return result;
}

/**
 * Find similar users from a list of candidate user IDs
 * Filters to only those where isSimilar() returns true
 * Stores results to Redis
 */
export async function findSimilarUsers(
  userId: string,
  candidateUserIds: string[]
): Promise<SimilarUser[]> {
  const similarUsers: SimilarUser[] = [];
  
  for (const candidateId of candidateUserIds) {
    // Skip comparing user to themselves
    if (candidateId === userId) continue;
    
    // Compute similarity
    const result = await computeSimilarity(userId, candidateId);
    
    // Store individual pair similarity to Redis
    await storeSimilarityPair(userId, candidateId, result.overallMatch);
    
    // If similar, add to results
    if (isSimilar(result)) {
      similarUsers.push({
        userId: candidateId,
        overallMatch: result.overallMatch,
      });
    }
  }
  
  // Sort by overall match (highest first)
  similarUsers.sort((a, b) => b.overallMatch - a.overallMatch);
  
  // Store to Redis
  await storeSimilarUsers(userId, similarUsers);
  
  return similarUsers;
}

/**
 * Get similar users with their match scores from Redis
 * Returns cached results if available
 */
export async function getSimilarUsersWithScores(
  userId: string
): Promise<SimilarUser[]> {
  return getSimilarUsers(userId);
}
