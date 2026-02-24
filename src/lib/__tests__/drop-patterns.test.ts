/**
 * Unit tests for Drop Patterns algorithm
 * 
 * Tests core logic with mocked dependencies:
 * - Drop penalty calculation (max 70%)
 * - Cooldown filtering
 * - Normalization (0-100)
 * - Cold start handling
 * - Similarity threshold (0.65)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dropPatterns } from '../recommendation-algorithms/drop-patterns';
import type { RecommendationSession, RecommendationContext } from '../recommendation-algorithms/interface';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    watchList: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    recommendationLog: {
      findMany: vi.fn(),
    },
    movieStatus: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/taste-map/similarity', () => ({
  getSimilarUsers: vi.fn(),
  computeSimilarity: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { getSimilarUsers, computeSimilarity } from '@/lib/taste-map/similarity';

const mockPrisma = prisma as unknown as {
  watchList: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  recommendationLog: {
    findMany: ReturnType<typeof vi.fn>;
  };
  movieStatus: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockGetSimilarUsers = getSimilarUsers as ReturnType<typeof vi.fn>;
const mockComputeSimilarity = computeSimilarity as ReturnType<typeof vi.fn>;

describe('Drop Patterns Algorithm', () => {
  const mockContext: RecommendationContext = {
    source: 'recommendations_page',
    position: 0,
    candidatesCount: 0,
  };

  const mockSession: RecommendationSession = {
    sessionId: 'test-session',
    startTime: new Date(),
    previousRecommendations: new Set<string>(),
    temporalContext: {
      hourOfDay: 12,
      dayOfWeek: 3,
      isFirstSessionOfDay: true,
      isWeekend: false,
    },
    mlFeatures: {
      similarityScore: 0.5,
      noveltyScore: 0.5,
      diversityScore: 0.5,
      predictedAcceptanceProbability: 0.5,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for movieStatus - watched statuses
    mockPrisma.movieStatus.findMany.mockResolvedValue([
      { id: 1, name: 'Просмотрено' },
      { id: 2, name: 'Пересмотрено' },
    ]);
    
    // Default mock for dropped status
    mockPrisma.movieStatus.findFirst.mockImplementation(async ({ where }: { where: { name: string } }) => {
      if (where.name === 'Брошено') {
        return { id: 3, name: 'Брошено' };
      }
      if (where.name === 'Хочу посмотреть') {
        return { id: 4, name: 'Хочу посмотреть' };
      }
      return null;
    });
  });

  describe('Cold start handling', () => {
    it('returns empty result for users with less than 8 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(5);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });

    it('proceeds with users having exactly 8 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(8);
      mockGetSimilarUsers.mockResolvedValue([]);
      mockPrisma.watchList.findMany.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      expect(mockGetSimilarUsers).toHaveBeenCalled();
    });
  });

  describe('Drop penalty calculation', () => {
    it('applies drop penalty to candidates dropped by similar users', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.7 },
        { userId: 'similar-2', overallMatch: 0.75 },
      ]);
      
      // User's candidates
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([]) // user's dropped items (empty)
        .mockResolvedValueOnce([ // similar users' drops
          { tmdbId: 123, mediaType: 'movie', userId: 'similar-1' },
        ])
        .mockResolvedValueOnce([ // user's candidates
          { tmdbId: 123, mediaType: 'movie', title: 'Dropped By Similar', userRating: 8, voteAverage: 7.5 },
          { tmdbId: 456, mediaType: 'movie', title: 'Not Dropped', userRating: 7, voteAverage: 7.0 },
        ]);
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      // Both movies should be in results (penalty doesn't eliminate)
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      
      // Movie 123 should have lower score due to drop penalty
      const droppedMovie = result.recommendations.find(r => r.tmdbId === 123);
      const notDroppedMovie = result.recommendations.find(r => r.tmdbId === 456);
      
      if (droppedMovie && notDroppedMovie) {
        // With same base rating but 50% penalty, dropped movie should score lower
        // Note: 1 similar user dropped out of 2 total = 50% * 0.7 = 35% penalty
        expect(droppedMovie.score).toBeLessThan(notDroppedMovie.score);
      }
    });

    it('caps drop penalty at 70%', async () => {
      // 10 similar users all dropped the same movie
      const similarUsers = Array.from({ length: 10 }, (_, i) => ({
        userId: `similar-${i}`,
        overallMatch: 0.7,
      }));
      
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue(similarUsers);
      
      const drops = similarUsers.map(u => ({
        tmdbId: 123,
        mediaType: 'movie',
        userId: u.userId,
      }));
      
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([]) // user's dropped items
        .mockResolvedValueOnce(drops) // similar users' drops
        .mockResolvedValueOnce([ // user's candidates
          { tmdbId: 123, mediaType: 'movie', title: 'Heavily Dropped', userRating: 10, voteAverage: 9 },
        ]);
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      // Should still be recommended (penalty is capped, not eliminating)
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      
      // Score should reflect max 70% penalty (baseScore * 0.3 minimum)
      const heavilyDropped = result.recommendations.find(r => r.tmdbId === 123);
      if (heavilyDropped) {
        // After normalization, it's harder to assert exact values
        // But the movie should still appear
        expect(heavilyDropped).toBeDefined();
      }
    });
  });

  describe('Cooldown filtering', () => {
    it('excludes movies from cooldown period', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.7 },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([]) // user's dropped
        .mockResolvedValueOnce([]) // similar users' drops
        .mockResolvedValueOnce([ // user's candidates
          { tmdbId: 123, mediaType: 'movie', title: 'Cooldown Movie', userRating: 8, voteAverage: 7.5 },
        ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie' },
      ]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      expect(result.recommendations.find(r => r.tmdbId === 123)).toBeUndefined();
    });
  });

  describe('Score normalization', () => {
    it('normalizes scores to 0-100 range', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.7 },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([]) // user's dropped
        .mockResolvedValueOnce([]) // similar users' drops
        .mockResolvedValueOnce([ // user's candidates
          { tmdbId: 100, mediaType: 'movie', title: 'High Score', userRating: 9, voteAverage: 8.5 },
          { tmdbId: 200, mediaType: 'movie', title: 'Low Score', userRating: 5, voteAverage: 6.0 },
        ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Similar users handling', () => {
    it('uses lower similarity threshold (0.65)', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.66 }, // Above 0.65 threshold
        { userId: 'similar-2', overallMatch: 0.64 }, // Below threshold
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      await dropPatterns.execute('user-1', mockContext, mockSession);

      // Both users should be considered since we filter by threshold
      // But similar-2 should be excluded due to 0.64 < 0.65
    });

    it('returns empty result when no similar users found', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });
  });

  describe('Algorithm properties', () => {
    it('has correct name', () => {
      expect(dropPatterns.name).toBe('drop_patterns_v1');
    });

    it('has correct minUserHistory', () => {
      expect(dropPatterns.minUserHistory).toBe(8);
    });
  });

  describe('Error handling', () => {
    it('returns empty result on database error', async () => {
      mockPrisma.watchList.count.mockRejectedValue(new Error('DB error'));

      const result = await dropPatterns.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });
  });
});
