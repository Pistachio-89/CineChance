/**
 * Recommendation Algorithm Types
 * 
 * Shared types for the modular recommendation algorithm system.
 * Each pattern implements IRecommendationAlgorithm using these types.
 */

import type {
  TemporalContext,
  MLFeatures,
} from '@/lib/recommendation-types';

/**
 * Context for recommendation generation
 * Passed from the caller to algorithm execute()
 */
export interface RecommendationContext {
  /** Where the recommendation is being shown */
  source: 'recommendations_page' | 'modal_recommendation' | 'sidebar';
  /** Position in the recommendation list (0-indexed) */
  position: number;
  /** Total candidates available before filtering */
  candidatesCount: number;
  /** User's current status for the item (if already in their list) */
  userStatus?: string | null;
  /** Whether filters have changed from previous request */
  filtersChanged?: boolean;
}

/**
 * Session data passed between algorithms
 * Tracks state across multiple algorithm calls
 */
export interface RecommendationSession {
  /** Unique session identifier */
  sessionId: string;
  /** When this session started */
  startTime: Date;
  /** TMDB IDs + mediaType already recommended in this session */
  previousRecommendations: Set<string>;
  /** Time-based context for temporal patterns */
  temporalContext: TemporalContext;
  /** ML features computed for this session */
  mlFeatures: MLFeatures;
  /** Sample size for heavy users (500+ watched items).
   * If set, algorithms should use take: session.sampleSize when querying user data */
  sampleSize?: number;
  /** Whether the user is a heavy user (500+ watched items).
   * Indicates that sampling was applied to their query */
  isHeavyUser?: boolean;
}

/**
 * A single recommendation item
 */
export interface RecommendationItem {
  /** TMDB ID of the movie/show */
  tmdbId: number;
  /** Media type: movie, tv, anime, cartoon */
  mediaType: string;
  /** Display title */
  title: string;
  /** Normalized score 0-100 */
  score: number;
  /** Algorithm that generated this recommendation */
  algorithm: string;
  /** User IDs who contributed to this recommendation (optional) */
  sources?: string[];
}

/**
 * Metrics about the recommendation generation process
 */
export interface RecommendationMetrics {
  /** Initial pool size before any filtering */
  candidatesPoolSize: number;
  /** Pool size after applying filters */
  afterFilters: number;
  /** Average score of final recommendations */
  avgScore: number;
}

/**
 * Result returned by an algorithm's execute() method
 */
export interface RecommendationResult {
  /** Generated recommendations (max 12) */
  recommendations: RecommendationItem[];
  /** Metrics about the generation process */
  metrics: RecommendationMetrics;
}

/**
 * Similar user with their match score
 * Used by algorithms that find similar users
 */
export interface SimilarUserForRecommendation {
  /** User ID */
  userId: string;
  /** Overall similarity match score (0-1) */
  overallMatch: number;
}

/**
 * Candidate movie from similar users' watch lists
 */
export interface CandidateMovie {
  /** TMDB ID */
  tmdbId: number;
  /** Media type */
  mediaType: string;
  /** Display title */
  title: string;
  /** User rating from the similar user (if available) */
  userRating: number | null;
  /** TMDB vote average */
  voteAverage: number;
  /** Similarity score of the user who contributed this */
  similarityScore: number;
  /** Count of similar users who have this item */
  cooccurrenceCount: number;
  /** User IDs who contributed this candidate */
  sourceUserIds: string[];
}

/**
 * Configuration for cooldown filtering
 */
export interface CooldownConfig {
  /** Number of days to exclude recently recommended items */
  days: number;
}

/**
 * Default cooldown configuration
 */
export const DEFAULT_COOLDOWN: CooldownConfig = {
  days: 7,
};

/**
 * Score normalization helper
 * Converts raw scores to 0-100 scale
 */
export function normalizeScore(rawScore: number, min: number, max: number): number {
  if (max === min) {
    // Single candidate gets max score
    return 100;
  }
  const normalized = (rawScore - min) / (max - min);
  return Math.max(0, Math.min(100, Math.round(normalized * 100)));
}

/**
 * Normalize an array of items with scores to 0-100 scale
 */
export function normalizeScores<T extends { score: number }>(
  items: T[]
): T[] {
  if (items.length === 0) return items;
  
  const scores = items.map(item => item.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  
  return items.map(item => ({
    ...item,
    score: normalizeScore(item.score, minScore, maxScore),
  }));
}
