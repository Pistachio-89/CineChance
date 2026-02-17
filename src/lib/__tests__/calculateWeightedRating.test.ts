import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateWeightedRating } from '../calculateWeightedRating';
import { prisma } from '../prisma';

// Мокаем prisma
vi.mock('../prisma', () => ({
  prisma: {
    watchList: {
      findUnique: vi.fn(),
    },
    ratingHistory: {
      findMany: vi.fn(),
    },
  },
}));

describe('calculateWeightedRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns original rating when no rating history exists', async () => {
    const mockFindUnique = prisma.watchList.findUnique as ReturnType<typeof vi.fn>;
    const mockFindMany = prisma.ratingHistory.findMany as ReturnType<typeof vi.fn>;

    // Мок: запись есть, но без истории оценок
    mockFindUnique.mockResolvedValue({
      id: 1,
      userRating: 8.0,
      weightedRating: null,
      watchCount: 1,
    });
    mockFindMany.mockResolvedValue([]);

    const result = await calculateWeightedRating('user-123', 550, 'movie');

    expect(result.weightedRating).toBe(8.0);
    expect(result.totalReviews).toBe(1);
    expect((result.calculationDetails as { method: string }).method).toBe('no_history');
  });

  it('calculates weighted rating with single review', async () => {
    const mockFindUnique = prisma.watchList.findUnique as ReturnType<typeof vi.fn>;
    const mockFindMany = prisma.ratingHistory.findMany as ReturnType<typeof vi.fn>;

    mockFindUnique.mockResolvedValue({
      id: 1,
      userRating: 7.0,
      weightedRating: null,
      watchCount: 1,
    });
    
    // Одна оценка с типом initial имеет вес 1.0
    mockFindMany.mockResolvedValue([
      { rating: 7.0, actionType: 'initial', createdAt: new Date() },
    ]);

    const result = await calculateWeightedRating('user-123', 550, 'movie');

    expect(result.weightedRating).toBe(7.0);
    expect(result.totalReviews).toBe(1);
    expect((result.calculationDetails as { method: string }).method).toBe('weighted_average');
  });

  it('calculates weighted rating closer to TMDB with many votes', async () => {
    const mockFindUnique = prisma.watchList.findUnique as ReturnType<typeof vi.fn>;
    const mockFindMany = prisma.ratingHistory.findMany as ReturnType<typeof vi.fn>;

    mockFindUnique.mockResolvedValue({
      id: 1,
      userRating: 9.0,
      weightedRating: null,
      watchCount: 1,
    });

    // Много оценок - разные веса
    // initial: 1.0 * 8.5 = 8.5
    // rating_change: 0.9 * 7.5 = 6.75
    // rewatch: 0.8 * 8.0 = 6.4 (index 2, weight = 1.0 - 2*0.2 = 0.6, but min is 0.3)
    // rewatch: 0.6 * 7.0 = 4.2 (index 3, weight = 1.0 - 3*0.2 = 0.4, but min is 0.3)
    // rewatch: 0.3 * 6.5 = 1.95 (index 4, weight = 1.0 - 4*0.2 = 0.2, capped at 0.3)
    mockFindMany.mockResolvedValue([
      { rating: 8.5, actionType: 'initial', createdAt: new Date() },
      { rating: 7.5, actionType: 'rating_change', createdAt: new Date() },
      { rating: 8.0, actionType: 'rewatch', createdAt: new Date() },
      { rating: 7.0, actionType: 'rewatch', createdAt: new Date() },
      { rating: 6.5, actionType: 'rewatch', createdAt: new Date() },
    ]);

    const result = await calculateWeightedRating('user-123', 550, 'movie');

    // Weighted sum: 8.5*1.0 + 7.5*0.9 + 8.0*0.6 + 7.0*0.4 + 6.5*0.3 = 8.5 + 6.75 + 4.8 + 2.8 + 1.95 = 24.8
    // Total weight: 1.0 + 0.9 + 0.6 + 0.4 + 0.3 = 3.2
    // Result: 24.8 / 3.2 = 7.75 ≈ 7.8
    expect(result.weightedRating).toBe(7.8);
    expect(result.totalReviews).toBe(5);
  });

  it('returns null when no record found', async () => {
    const mockFindUnique = prisma.watchList.findUnique as ReturnType<typeof vi.fn>;
    const mockFindMany = prisma.ratingHistory.findMany as ReturnType<typeof vi.fn>;

    mockFindUnique.mockResolvedValue(null);

    const result = await calculateWeightedRating('user-123', 550, 'movie');

    expect(result.weightedRating).toBeNull();
    expect(result.totalReviews).toBe(0);
    expect((result.calculationDetails as { error: string }).error).toBe('No rating found');
  });

  it('handles rewatch weights with decreasing values', async () => {
    const mockFindUnique = prisma.watchList.findUnique as ReturnType<typeof vi.fn>;
    const mockFindMany = prisma.ratingHistory.findMany as ReturnType<typeof vi.fn>;

    mockFindUnique.mockResolvedValue({
      id: 1,
      userRating: 10.0,
      weightedRating: null,
      watchCount: 1,
    });

    // Только rewatch оценки - проверяем убывающие веса
    mockFindMany.mockResolvedValue([
      { rating: 10.0, actionType: 'initial', createdAt: new Date() },
      { rating: 9.0, actionType: 'rewatch', createdAt: new Date() }, // index 1: max(0.3, 1.0 - 0.2) = 0.8
      { rating: 8.0, actionType: 'rewatch', createdAt: new Date() }, // index 2: max(0.3, 1.0 - 0.4) = 0.6
      { rating: 7.0, actionType: 'rewatch', createdAt: new Date() }, // index 3: max(0.3, 1.0 - 0.6) = 0.4
    ]);

    const result = await calculateWeightedRating('user-123', 550, 'movie');

    // Weighted: 10.0*1.0 + 9.0*0.8 + 8.0*0.6 + 7.0*0.4 = 10 + 7.2 + 4.8 + 2.8 = 24.8
    // Weight: 1.0 + 0.8 + 0.6 + 0.4 = 2.8
    // Result: 24.8 / 2.8 = 8.857 ≈ 8.9
    expect(result.weightedRating).toBe(8.9);
    expect((result.calculationDetails as { method: string }).method).toBe('weighted_average');
  });
});
