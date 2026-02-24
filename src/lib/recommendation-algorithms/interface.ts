/**
 * Recommendation Algorithm Interface
 * 
 * Common interface that all recommendation patterns implement.
 * Enables consistent execution, testing, and integration.
 */

import type {
  RecommendationContext,
  RecommendationSession,
  RecommendationResult,
} from './types';

/**
 * Interface for recommendation algorithms
 * 
 * All pattern modules (taste-match, want-overlap, etc.) implement this interface
 * to ensure consistent behavior across the recommendation system.
 */
export interface IRecommendationAlgorithm {
  /** Unique algorithm identifier (e.g., 'taste_match', 'want_overlap') */
  readonly name: string;
  
  /** Minimum user history required for this algorithm to work effectively */
  readonly minUserHistory: number;
  
  /**
   * Execute the algorithm to generate recommendations
   * 
   * @param userId - Target user ID
   * @param context - Context about the recommendation request
   * @param sessionData - Session state passed between algorithms
   * @returns Promise resolving to recommendations and metrics
   */
  execute(
    userId: string,
    context: RecommendationContext,
    sessionData: RecommendationSession
  ): Promise<RecommendationResult>;
}

/**
 * Re-export types from types.ts for convenience
 */
export type {
  RecommendationContext,
  RecommendationSession,
  RecommendationResult,
  RecommendationItem,
  RecommendationMetrics,
  SimilarUserForRecommendation,
  CandidateMovie,
  CooldownConfig,
} from './types';

export {
  normalizeScore,
  normalizeScores,
  DEFAULT_COOLDOWN,
} from './types';
