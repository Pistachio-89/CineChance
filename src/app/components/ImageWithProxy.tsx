// src/app/components/ImageWithProxy.tsx
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useState, memo } from 'react';

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
  style?: React.CSSProperties;
}

const ImageWithProxy = memo(({
  src,
  alt,
  fill = false,
  width,
  height,
  priority = false,
  className = '',
  onError,
  onLoad,
  fallbackSrc = '/placeholder-poster.svg',
  style
}: ImageWithProxyProps) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
    onError?.();
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageError(false);
    onLoad?.();
  };

  const getImageSrc = () => {
    if (imageError) {
      return fallbackSrc;
    }

    // Используем прокси для TMDB изображений
    if (src.includes('image.tmdb.org')) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }

    return src;
  };

  const imageSrc = getImageSrc();

  const imgStyle: React.CSSProperties = fill
    ? { ...style, objectFit: 'cover' }
    : { ...style };

  if (fill) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        style={imgStyle}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={imgStyle}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onError={handleImageError}
      onLoad={handleImageLoad}
    />
  );
});

ImageWithProxy.displayName = 'ImageWithProxy';

export default ImageWithProxy;
