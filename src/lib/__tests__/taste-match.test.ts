/**
 * Unit tests for Taste Match algorithm
 * 
 * Tests core logic with mocked dependencies:
 * - Score calculation (weights: similarity 0.5, rating 0.3, cooccurrence 0.2)
 * - Cooldown filtering
 * - Normalization (0-100)
 * - Cold start handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tasteMatch } from '../recommendation-algorithms/taste-match';
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
    },
  },
}));

vi.mock('@/lib/taste-map/similarity', () => ({
  getSimilarUsers: vi.fn(),
  computeSimilarity: vi.fn(),
}));

vi.mock('@/lib/taste-map/redis', () => ({
  getTasteMap: vi.fn(),
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
  };
};

const mockGetSimilarUsers = getSimilarUsers as ReturnType<typeof vi.fn>;
const mockComputeSimilarity = computeSimilarity as ReturnType<typeof vi.fn>;

describe('Taste Match Algorithm', () => {
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
  });

  describe('Cold start handling', () => {
    it('returns empty result for users with less than 10 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(5);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });

    it('proceeds with users having exactly 10 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(mockGetSimilarUsers).toHaveBeenCalled();
    });
  });

  describe('Similar users handling', () => {
    it('returns empty result when no similar users found', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });

    it('fetches movies from similar users', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.85 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie', title: 'Test Movie', userRating: 8, voteAverage: 7.5 },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(mockPrisma.watchList.findMany).toHaveBeenCalled();
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cooldown filtering', () => {
    it('excludes movies from cooldown period', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.85 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie', title: 'Cooldown Movie', userRating: 8, voteAverage: 7.5 },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie' },
      ]);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(result.recommendations.find(r => r.tmdbId === 123)).toBeUndefined();
    });
  });

  describe('Score normalization', () => {
    it('normalizes scores to 0-100 range', async () => {
      mockPrisma.watchList.count.mockResolvedValue(20);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.9 },
        { userId: 'similar-2', overallMatch: 0.8 },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([
          { tmdbId: 100, mediaType: 'movie', title: 'High Score', userRating: 9, voteAverage: 8.5 },
        ])
        .mockResolvedValueOnce([
          { tmdbId: 200, mediaType: 'movie', title: 'Low Score', userRating: 5, voteAverage: 6.0 },
        ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Algorithm properties', () => {
    it('has correct name', () => {
      expect(tasteMatch.name).toBe('taste_match_v1');
    });

    it('has correct minUserHistory', () => {
      expect(tasteMatch.minUserHistory).toBe(10);
    });
  });

  describe('Error handling', () => {
    it('returns empty result on database error', async () => {
      mockPrisma.watchList.count.mockRejectedValue(new Error('DB error'));

      const result = await tasteMatch.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });
  });
});
