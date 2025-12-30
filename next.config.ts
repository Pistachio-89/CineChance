// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
    unoptimized: true,
  },

  experimental: {
    serverActions: {
      // Разрешаем Server Actions с preview-доменов GitHub Codespaces
      allowedOrigins: [
        'localhost:3000',
        '*.app.github.dev',
        '*.github.dev',
      ],
    },
  },
};

export default nextConfig;