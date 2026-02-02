// src/app/components/ImageWithProxy.tsx
'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import { logger } from '@/lib/logger';

interface ImageWithProxyProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  blurDataURL?: string;
  onError?: () => void;
  onLoad?: () => void;
  fallbackSrc?: string;
  quality?: number;
}

const ImageWithProxy = memo(({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes = "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw",
  priority = false,
  className = '',
  blurDataURL,
  onError,
  onLoad,
  fallbackSrc = '/placeholder-poster.svg',
  quality = 75
}: ImageWithProxyProps) => {
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleImageError = () => {
    logger.warn('Image load failed, trying proxy', { 
      src, 
      retryCount 
    });
    
    if (retryCount < 1 && !imageError) {
      // Пробуем через наш прокси
      setRetryCount(prev => prev + 1);
    } else {
      // Все попытки исчерпаны
      logger.warn('All image attempts failed, showing fallback', { src });
      setImageError(true);
      onError?.();
    }
  };

  const handleImageLoad = () => {
    setImageError(false);
    onLoad?.();
    logger.info('Image loaded successfully', { src, retryCount });
  };

  // Определяем источник изображения
  const getImageSrc = () => {
    if (imageError) {
      return fallbackSrc;
    }

    // Если это retry и это TMDB изображение, используем прокси
    if (retryCount > 0 && src.includes('image.tmdb.org')) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }

    return src;
  };

  const imageSrc = getImageSrc();

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
      loading={priority ? "eager" : "lazy"}
      placeholder="blur"
      blurDataURL={blurDataURL || "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="}
      onError={handleImageError}
      onLoad={handleImageLoad}
      unoptimized={true}
      quality={quality}
    />
  );
});

ImageWithProxy.displayName = 'ImageWithProxy';

export default ImageWithProxy;
