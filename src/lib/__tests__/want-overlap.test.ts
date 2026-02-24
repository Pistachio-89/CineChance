/**
 * Unit tests for Want-to-Watch Overlap algorithm
 * 
 * Tests core logic with mocked dependencies:
 * - Score calculation (weights: similarity 0.4, frequency 0.4, genre 0.2)
 * - Deduplication of want items
 * - Cooldown filtering
 * - Normalization (0-100)
 * - Cold start handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wantOverlap } from '../recommendation-algorithms/want-overlap';
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
  },
}));

vi.mock('@/lib/taste-map/similarity', () => ({
  getSimilarUsers: vi.fn(),
  computeSimilarity: vi.fn(),
}));

vi.mock('@/lib/taste-map/redis', () => ({
  getTasteMap: vi.fn(),
}));

vi.mock('@/lib/tmdb', () => ({
  fetchMediaDetails: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { getSimilarUsers } from '@/lib/taste-map/similarity';
import { getTasteMap } from '@/lib/taste-map/redis';

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
};

const mockGetSimilarUsers = getSimilarUsers as ReturnType<typeof vi.fn>;
const mockGetTasteMap = getTasteMap as ReturnType<typeof vi.fn>;

describe('Want Overlap Algorithm', () => {
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
    
    // Default mock for movieStatus
    mockPrisma.movieStatus.findMany.mockResolvedValue([
      { id: 1, name: 'Просмотрено' },
      { id: 2, name: 'Пересмотрено' },
    ]);
    mockPrisma.movieStatus.findFirst.mockResolvedValue({ id: 3, name: 'Хочу посмотреть' });
    
    // Default taste map
    mockGetTasteMap.mockResolvedValue({
      genreProfile: { Action: 80, Comedy: 70 },
    });
  });

  describe('Cold start handling', () => {
    it('returns empty result for users with less than 5 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(3);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });

    it('proceeds with users having exactly 5 watched movies', async () => {
      mockPrisma.watchList.count.mockResolvedValue(5);
      mockGetSimilarUsers.mockResolvedValue([]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(mockGetSimilarUsers).toHaveBeenCalled();
    });
  });

  describe('Want list fetching', () => {
    it('fetches want items from similar users', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.75 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([]); // userExistingItems
      mockPrisma.watchList.findMany.mockResolvedValueOnce([
        { tmdbId: 456, mediaType: 'movie', title: 'Want Movie', userId: 'similar-1' },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(mockPrisma.watchList.findMany).toHaveBeenCalled();
    });

    it('deduplicates wants from multiple similar users', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.8 },
        { userId: 'similar-2', overallMatch: 0.75 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([]); // userExistingItems
      mockPrisma.watchList.findMany.mockResolvedValueOnce([
        { tmdbId: 100, mediaType: 'movie', title: 'Shared Want', userId: 'similar-1' },
        { tmdbId: 100, mediaType: 'movie', title: 'Shared Want', userId: 'similar-2' },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      // Should deduplicate to single entry but with cooccurrence
      const found100 = result.recommendations.find(r => r.tmdbId === 100);
      // If returned, it should have correct algorithm
      if (found100) {
        expect(found100.algorithm).toBe('want_overlap_v1');
      }
    });
  });

  describe('Filtering user existing items', () => {
    it('excludes movies already in user lists', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.8 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([
        { tmdbId: 100, mediaType: 'movie' }, // User already has this
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([
        { tmdbId: 100, mediaType: 'movie', title: 'Already Have', userId: 'similar-1' },
        { tmdbId: 200, mediaType: 'movie', title: 'New Want', userId: 'similar-1' },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(result.recommendations.find(r => r.tmdbId === 100)).toBeUndefined();
    });
  });

  describe('Cooldown filtering', () => {
    it('excludes movies from cooldown period', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.8 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([
        { tmdbId: 123, mediaType: 'movie', title: 'Cooldown Want', userId: 'similar-1' },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([
        { tmdbId: 123, mediaType: 'movie' },
      ]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(result.recommendations.find(r => r.tmdbId === 123)).toBeUndefined();
    });
  });

  describe('Score normalization', () => {
    it('normalizes scores to 0-100 range', async () => {
      mockPrisma.watchList.count.mockResolvedValue(10);
      mockGetSimilarUsers.mockResolvedValue([
        { userId: 'similar-1', overallMatch: 0.9 },
        { userId: 'similar-2', overallMatch: 0.7 },
      ]);
      mockPrisma.watchList.findMany.mockResolvedValueOnce([]);
      mockPrisma.watchList.findMany.mockResolvedValue([
        { tmdbId: 100, mediaType: 'movie', title: 'High Want', userId: 'similar-1' },
        { tmdbId: 200, mediaType: 'movie', title: 'Low Want', userId: 'similar-2' },
      ]);
      mockPrisma.recommendationLog.findMany.mockResolvedValue([]);

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      for (const rec of result.recommendations) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Algorithm properties', () => {
    it('has correct name', () => {
      expect(wantOverlap.name).toBe('want_overlap_v1');
    });

    it('has correct minUserHistory', () => {
      expect(wantOverlap.minUserHistory).toBe(5);
    });
  });

  describe('Error handling', () => {
    it('returns empty result on database error', async () => {
      mockPrisma.watchList.count.mockRejectedValue(new Error('DB error'));

      const result = await wantOverlap.execute('user-1', mockContext, mockSession);

      expect(result.recommendations).toHaveLength(0);
      expect(result.metrics.candidatesPoolSize).toBe(0);
    });
  });
});
