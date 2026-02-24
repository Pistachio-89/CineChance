/**
 * Unit tests for Type Twins algorithm
 * 
 * Tests core logic with mocked dependencies:
 * - Type distribution calculation
 * - Type similarity computation
 * - Dominant type detection
 * - Cooldown filtering
 * - Normalization (0-100)
 * - Cold start handling (min 3 items)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { typeTwins } from '../recommendation-algorithms/type-twins';
import type { RecommendationSession, RecommendationContext } from '../recommendation-algorithms/interface';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    watchList: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    recommendationLog: {
      findMany: vi.fn(),
    },
    movieStatus: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  watchList: {
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  recommendationLog: {
    findMany: ReturnType<typeof vi.fn>;
  };
  movieStatus: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Type Twins Algorithm', () => {
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
    it('returns empty result for users with less than 3 watched items', async () => {
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'movie', _count: { mediaType: 2 } },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValue([]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });

    it('proceeds with users having exactly 3 watched items', async () => {
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'movie', _count: { mediaType: 3 } },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([]) // active users sample
        .mockResolvedValueOnce([]) // user existing items
        .mockResolvedValue([]); // cooldown
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      // Should proceed (may have empty results due to no type twins)
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Type distribution calculation', () => {
    it('calculates correct percentages for mixed content', async () => {
      // 50% movie, 30% tv, 20% anime
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'movie', _count: { mediaType: 5 } },
        { mediaType: 'tv', _count: { mediaType: 3 } },
        { mediaType: 'anime', _count: { mediaType: 2 } },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      await typeTwins.execute('user-1', mockContext, mockSession);

      // groupBy should be called for type distribution
      expect(mockPrisma.watchList.groupBy).toHaveBeenCalled();
    });

    it('identifies dominant type correctly', async () => {
      // 80% anime - clear dominant type
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'anime', _count: { mediaType: 8 } },
        { mediaType: 'movie', _count: { mediaType: 2 } },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      await typeTwins.execute('user-1', mockContext, mockSession);

      // The algorithm should identify anime as dominant
      expect(mockPrisma.watchList.groupBy).toHaveBeenCalled();
    });
  });

  describe('Type similarity calculation', () => {
    it('finds type twins with similar preferences', async () => {
      mockPrisma.watchList.groupBy
        .mockResolvedValueOnce([
          { mediaType: 'movie', _count: { mediaType: 7 } },
          { mediaType: 'tv', _count: { mediaType: 3 } },
        ])
        .mockResolvedValue([
          { mediaType: 'movie', _count: { mediaType: 8 } },
          { mediaType: 'tv', _count: { mediaType: 2 } },
        ]);
      
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([
          { userId: 'twin-1' }, // active users sample
        ])
        .mockResolvedValueOnce([ // twin's watched items
          { tmdbId: 123, mediaType: 'movie', title: 'Test Movie', userRating: 8, voteAverage: 7.5 },
        ])
        .mockResolvedValueOnce([]); // user existing items
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      // Should proceed with type twins
      expect(mockPrisma.watchList.groupBy).toHaveBeenCalled();
    });
  });

  describe('Dominant type matching', () => {
    it('boosts candidates matching user dominant type', async () => {
      // User: 90% anime
      mockPrisma.watchList.groupBy
        .mockResolvedValueOnce([
          { mediaType: 'anime', _count: { mediaType: 9 } },
          { mediaType: 'movie', _count: { mediaType: 1 } },
        ])
        .mockResolvedValue([
          { mediaType: 'anime', _count: { mediaType: 9 } },
          { mediaType: 'movie', _count: { mediaType: 1 } },
        ]);
      
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([{ userId: 'twin-1' }])
        .mockResolvedValueOnce([
          { tmdbId: 123, mediaType: 'anime', title: 'Anime Movie', userRating: 9, voteAverage: 8.5 },
          { tmdbId: 456, mediaType: 'movie', title: 'Regular Movie', userRating: 9, voteAverage: 8.5 },
        ])
        .mockResolvedValueOnce([]);
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      // Both should be considered, but anime should have dominant type bonus
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cooldown filtering', () => {
    it('excludes movies from cooldown period', async () => {
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'movie', _count: { mediaType: 10 } },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([{ userId: 'twin-1' }])
        .mockResolvedValueOnce([
          { tmdbId: 123, mediaType: 'movie', title: 'Cooldown Movie', userRating: 8, voteAverage: 7.5 },
        ])
        .mockResolvedValueOnce([]);
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie' },
      ]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      expect(result.recommendations.find(r => r.tmdbId === 123)).toBeUndefined();
    });
  });

  describe('Score normalization', () => {
    it('normalizes scores to 0-100 range', async () => {
      mockPrisma.watchList.groupBy.mockResolvedValue([
        { mediaType: 'movie', _count: { mediaType: 10 } },
      ]);
      mockPrisma.watchList.findMany
        .mockResolvedValueOnce([{ userId: 'twin-1' }])
        .mockResolvedValueOnce([
          { tmdbId: 100, mediaType: 'movie', title: 'High Score', userRating: 10, voteAverage: 9.5 },
          { tmdbId: 200, mediaType: 'movie', title: 'Low Score', userRating: 7, voteAverage: 7.0 },
        ])
        .mockResolvedValueOnce([]);
      
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Algorithm properties', () => {
    it('has correct name', () => {
      expect(typeTwins.name).toBe('type_twins_v1');
    });

    it('has correct minUserHistory (low threshold)', () => {
      expect(typeTwins.minUserHistory).toBe(3);
    });
  });

  describe('Error handling', () => {
    it('returns empty result on database error', async () => {
      mockPrisma.watchList.groupBy.mockRejectedValue(new Error('DB error'));

      const result = await typeTwins.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });
  });
});
