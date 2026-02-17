import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Calculation detail interface for weighted rating details
 */
interface CalculationDetail {
  index: number;
  rating: number;
  actionType: string;
  weight: number;
  weightedValue: number;
}

/**
 * Type for calculation details returned from weighted rating
 */
type CalculationDetails = 
  | { error: string; hasRecord?: boolean; userRating?: number | null }
  | { method: 'no_history'; finalRating: number; historyLength: number }
  | { method: 'weighted_average'; weightedSum: number; totalWeight: number; finalRating: number; originalRating: number; calculations: CalculationDetail[]; historyLength: number }
  | { method: 'fallback_zero_weight'; finalRating: number; totalWeight: number };

/**
 * Весовая функция для оценки в зависимости от порядка и типа
 */
const getWeightByReviewOrder = (reviewIndex: number, actionType: string): number => {
  switch (actionType) {
    case 'initial': return 1.0; // Первая оценка - максимальный вес
    case 'rating_change': return 0.9; // Изменение оценки
    case 'rewatch': return Math.max(0.3, 1.0 - (reviewIndex * 0.2)); // Пересмотры с убывающим весом
    default: return 0.5;
  }
};

/**
 * Расчет взвешенной оценки пользователя с учетом всех пересмотров
 */
export async function calculateWeightedRating(
  userId: string,
  tmdbId: number,
  mediaType: string
): Promise<{ weightedRating: number | null; totalReviews: number; calculationDetails: CalculationDetails }> {
  try {
    // Получаем текущую запись
    const currentRecord = await prisma.watchList.findUnique({
      where: {
        userId_tmdbId_mediaType: {
          userId,
          tmdbId,
          mediaType,
        },
      },
      select: {
        id: true,
        userRating: true,
        weightedRating: true,
        watchCount: true,
      },
    });

    if (!currentRecord || !currentRecord.userRating) {
      return {
        weightedRating: null,
        totalReviews: 0,
        calculationDetails: { 
          error: 'No rating found',
          hasRecord: !!currentRecord,
          userRating: currentRecord?.userRating
        }
      };
    }

    // Если нет истории оценок, возвращаем текущую оценку
    const ratingHistory = await prisma.ratingHistory.findMany({
      where: {
        userId,
        tmdbId,
        mediaType,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        rating: true,
        actionType: true,
        createdAt: true,
      },
    });

    if (ratingHistory.length === 0) {
      return {
        weightedRating: currentRecord.userRating,
        totalReviews: 1,
        calculationDetails: {
          method: 'no_history',
          finalRating: currentRecord.userRating,
          historyLength: 0
        }
      };
    }

    // Расчет взвешенной оценки
    let weightedSum = 0;
    let totalWeight = 0;
    const calculations: CalculationDetail[] = [];

    ratingHistory.forEach((review, index) => {
      const weight = getWeightByReviewOrder(index, review.actionType);
      weightedSum += review.rating * weight;
      totalWeight += weight;
      
      calculations.push({
        index,
        rating: review.rating,
        actionType: review.actionType,
        weight,
        weightedValue: review.rating * weight
      });
    });

    // Если вес равен 0 (маловероятно), возвращаем обычную оценку
    if (totalWeight === 0) {
      return {
        weightedRating: currentRecord.userRating,
        totalReviews: ratingHistory.length,
        calculationDetails: {
          method: 'fallback_zero_weight',
          finalRating: currentRecord.userRating,
          totalWeight
        }
      };
    }

    const weightedRating = Math.round((weightedSum / totalWeight) * 10) / 10;

    return {
      weightedRating,
      totalReviews: ratingHistory.length,
      calculationDetails: {
        method: 'weighted_average',
        weightedSum,
        totalWeight,
        finalRating: weightedRating,
        originalRating: currentRecord.userRating,
        calculations,
        historyLength: ratingHistory.length
      }
    };

  } catch (error) {
    logger.error('Error calculating weighted rating', { error: error instanceof Error ? error.message : String(error) });
    return {
      weightedRating: null,
      totalReviews: 0,
      calculationDetails: { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    };
  }
}
