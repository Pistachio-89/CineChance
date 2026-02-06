// src/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// Кеширование Redis-соединения
let redisInstance: Redis | null = null;

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis environment variables not configured, rate limiting disabled');
    return null;
  }
  
  try {
    redisInstance = new Redis({
      url,
      token,
    });
    return redisInstance;
  } catch (error) {
    logger.error('Failed to initialize Redis connection', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'RateLimit'
    });
    return null;
  }
}

// Конфигурация лимитов для разных эндпоинтов
const endpointLimits: Record<string, { points: number; duration: number }> = {
  '/api/search': { points: 100, duration: 60 }, // 100 запросов в минуту для поиска
  '/api/recommendations': { points: 30, duration: 60 }, // 30 запросов в минуту
  '/api/user': { points: 60, duration: 60 }, // 60 запросров в минуту
  '/api/watchlist': { points: 200, duration: 60 }, // 200 запросов в минуту для batch-загрузки
  '/api/cine-chance-rating': { points: 300, duration: 60 }, // 300 запросов в минуту для деталей фильмов
  '/api/movie-details': { points: 300, duration: 60 }, // 300 запросов в минуту для деталей фильмов
  'default': { points: 100, duration: 60 }, // 100 запросов в минуту
};

// Кеширование Ratelimit instances
const ratelimitCache: Map<string, Ratelimit> = new Map();

function getRatelimit(endpoint: string): Ratelimit | null {
  const cacheKey = `${endpoint}`;
  if (ratelimitCache.has(cacheKey)) {
    return ratelimitCache.get(cacheKey)!;
  }
  
  const redis = getRedis();
  if (!redis) return null;
  
  const config = endpointLimits[endpoint] || endpointLimits['default'];
  
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.points, `${config.duration} s`),
    analytics: true,
  });
  
  ratelimitCache.set(cacheKey, ratelimit);
  return ratelimit;
}

export async function rateLimit(req: Request, endpoint: string, userId?: string) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const key = userId ? `user:${userId}` : `ip:${ip}`;
  const config = endpointLimits[endpoint] || endpointLimits['default'];
  
  const ratelimit = getRatelimit(endpoint);
  
  // Если Redis не доступен, пропускаем запрос
  if (!ratelimit) {
    return { success: true, limit: config.points, remaining: config.points, reset: Date.now() + config.duration * 1000 };
  }

  try {
    const { success, limit, remaining, reset } = await ratelimit.limit(key);

    if (!success) {
      logger.warn(`Rate limit exceeded for ${key} on ${endpoint}. Limit: ${limit}, Remaining: ${remaining}, Reset: ${reset}`);
    }

    return { success, limit, remaining, reset };
  } catch (error) {
    // Если произошла ошибка при проверке лимита, пропускаем запрос
    logger.error(`Rate limit check failed for ${key} on ${endpoint}`, { 
      error: error instanceof Error ? error.message : String(error),
      context: 'RateLimit'
    });
    return { success: true, limit: config.points, remaining: config.points, reset: Date.now() + config.duration * 1000 };
  }
}
