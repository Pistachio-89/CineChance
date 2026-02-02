import { NextResponse } from 'next/server';
import { rateLimit } from '@/middleware/rateLimit';
import { Redis } from '@upstash/redis';

// Redis клиент для кэширования
const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const { success } = await rateLimit(req, 'default');
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  const fallbackUrl = searchParams.get('fallback');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  // Создаем ключ для кэша
  const cacheKey = `image-proxy:${Buffer.from(imageUrl).toString('base64')}`;
  
  try {
    // Проверяем кэш
    const cachedImage = await redis.get(cacheKey);
    if (cachedImage) {
      console.log('Cache hit for:', imageUrl);
      const { data, contentType } = cachedImage as { data: string, contentType: string };
      
      return new NextResponse(Buffer.from(data, 'base64'), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // 24 часа для браузера
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'X-Cache': 'HIT',
        },
      });
    }

    console.log('Cache miss, fetching:', imageUrl);
    
    // Пробуем основной URL с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(imageBuffer).toString('base64');
    
    // Определяем content type
    const contentType = response.headers.get('content-type') || 
      (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') ? 'image/jpeg' :
       imageUrl.includes('.png') ? 'image/png' :
       imageUrl.includes('.webp') ? 'image/webp' : 'image/jpeg');

    // Сохраняем в кэш на 6 часов для баланса между свежестью и производительностью
    await redis.setex(cacheKey, 21600, {
      data: base64Data,
      contentType: contentType
    });

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24 часа для браузера
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Cache': 'MISS',
      },
    });

  } catch (error) {
    console.error('Image proxy error:', error);
    
    // Если есть fallback URL, пробуем его
    if (fallbackUrl) {
      try {
        const fallbackCacheKey = `image-proxy:${Buffer.from(fallbackUrl).toString('base64')}`;
        const cachedFallback = await redis.get(fallbackCacheKey);
        
        if (cachedFallback) {
          const { data, contentType } = cachedFallback as { data: string, contentType: string };
          return new NextResponse(Buffer.from(data, 'base64'), {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Cache': 'HIT-FALLBACK',
            },
          });
        }

        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });

        if (fallbackResponse.ok) {
          const fallbackBuffer = await fallbackResponse.arrayBuffer();
          const fallbackBase64 = Buffer.from(fallbackBuffer).toString('base64');
          const fallbackContentType = fallbackResponse.headers.get('content-type') || 'image/jpeg';
          
          // Кэшируем fallback на 6 часов
          await redis.setex(fallbackCacheKey, 21600, {
            data: fallbackBase64,
            contentType: fallbackContentType
          });

          return new NextResponse(fallbackBuffer, {
            headers: {
              'Content-Type': fallbackContentType,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Cache': 'MISS-FALLBACK',
            },
          });
        }
      } catch (fallbackError) {
        console.error('Fallback image error:', fallbackError);
      }
    }

    // Если все failed, возвращаем placeholder
    try {
      const placeholderResponse = await fetch(new URL('/placeholder-poster.svg', req.url));
      if (placeholderResponse.ok) {
        const placeholderBuffer = await placeholderResponse.arrayBuffer();
        return new NextResponse(placeholderBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'PLACEHOLDER',
          },
        });
      }
    } catch (placeholderError) {
      console.error('Placeholder error:', placeholderError);
    }

    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
