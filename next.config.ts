// next.config.ts
import type { NextConfig } from "next";
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  images: {
    // ⚠️ CRITICAL: Отключаем Image Optimization полностью чтобы не сжечь лимит Vercel
    // Все изображения загружаются как-есть без обработки на Vercel
    unoptimized: true,
    
    // Разрешаем внешние домены (но они не будут оптимизироваться)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.fanart.tv",
        pathname: "/**",
      },
    ],
    
    // Эти параметры игнорируются если unoptimized: true, но оставляем для документации
    qualities: [75, 85],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        'cinechance.vercel.app',
        'www.cinechance.vercel.app',
        '*.app.github.dev',
        'localhost:3000',
      ],
    },
  },

  // Исключаем TypeScript файлы в scripts из сборки
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withBundleAnalyzer(nextConfig);