/**
 * Recommendation Algorithms - Main Entry Point
 *
 * Exports all recommendation pattern algorithms for use in API endpoints.
 * Each algorithm implements IRecommendationAlgorithm interface.
 */

import { tasteMatch } from './recommendation-algorithms/taste-match';
import { wantOverlap } from './recommendation-algorithms/want-overlap';
import { dropPatterns } from './recommendation-algorithms/drop-patterns';
import { typeTwins } from './recommendation-algorithms/type-twins';
import { personTwins } from './recommendation-algorithms/person-twins';
import { personRecommendations } from './recommendation-algorithms/person-recommendations';
import { genreTwins } from './recommendation-algorithms/genre-twins';
import { genreRecommendations } from './recommendation-algorithms/genre-recommendations';

// Re-export types and interface
export type {
  IRecommendationAlgorithm,
  RecommendationContext,
  RecommendationSession,
  RecommendationResult,
  RecommendationItem,
  RecommendationMetrics,
} from './recommendation-algorithms/interface';

export {
  normalizeScore,
  normalizeScores,
  DEFAULT_COOLDOWN,
} from './recommendation-algorithms/interface';

// Export individual algorithms
export { tasteMatch } from './recommendation-algorithms/taste-match';
export { wantOverlap } from './recommendation-algorithms/want-overlap';
export { dropPatterns } from './recommendation-algorithms/drop-patterns';
export { typeTwins } from './recommendation-algorithms/type-twins';
export { personTwins } from './recommendation-algorithms/person-twins';
export { personRecommendations } from './recommendation-algorithms/person-recommendations';
export { genreTwins } from './recommendation-algorithms/genre-twins';
export { genreRecommendations } from './recommendation-algorithms/genre-recommendations';

/**
 * All available recommendation algorithms
 *
 * Algorithms are ordered by priority - first algorithms are preferred
 * for users with sufficient history.
 *
 * Pattern 1 (tasteMatch): Similar users' watched movies
 * Pattern 2 (wantOverlap): Similar users' want lists
 * Pattern 3 (dropPatterns): Avoid content similar users dropped
 * Pattern 4 (typeTwins): Content type preference matching
 * Pattern 5 (personTwins): Users with similar favorite actors/directors
 * Pattern 6 (personRecommendations): Movies featuring user's favorite persons
 * Pattern 7 (genreTwins): Users with similar genre preferences
 * Pattern 8 (genreRecommendations): Movies in user's dominant genres
 */
export const recommendationAlgorithms = [
  tasteMatch,
  wantOverlap,
  dropPatterns,
  typeTwins,
  personTwins,
  personRecommendations,
  genreTwins,
  genreRecommendations,
];

/**
 * Get algorithm by name
 */
export function getAlgorithmByName(name: string) {
  return recommendationAlgorithms.find(algo => algo.name === name);
}

/**
 * Default export for convenience
 */
export default recommendationAlgorithms;
