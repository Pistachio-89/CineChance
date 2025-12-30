import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get('tmdbId');
  const mediaType = searchParams.get('mediaType'); // 'movie' or 'tv'

  if (!tmdbId) {
    return NextResponse.json({ poster: null });
  }

  const apiKey = process.env.FANART_TV_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ poster: null });
  }

  try {
    // Fanart.tv uses different endpoints for movies and TV
    const endpoint = mediaType === 'tv' 
      ? `https://webservice.fanart.tv/v3/tv/${tmdbId}?api_key=${apiKey}`
      : `https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${apiKey}`;

    const res = await fetch(endpoint);
    
    if (!res.ok) {
      return NextResponse.json({ poster: null });
    }

    const data = await res.json();

    // Get movie poster from Fanart.tv response
    // They have 'movieposter' array with different sizes
    const posters = data.movieposter || data.tvposter || [];
    
    if (posters.length > 0) {
      // Sort by language (prefer original/en, then any available)
      const sorted = posters.sort((a: any, b: any) => {
        const langOrder = { en: 0, '': 1, default: 2 };
        const aLang = langOrder[a.lang as keyof typeof langOrder] ?? 2;
        const bLang = langOrder[b.lang as keyof typeof langOrder] ?? 2;
        return aLang - bLang;
      });

      // Return the highest rated poster
      const bestPoster = sorted[0];
      return NextResponse.json({
        poster: bestPoster.url,
        thumb: bestPoster.thumb || bestPoster.url,
      });
    }

    return NextResponse.json({ poster: null });
  } catch (error) {
    console.error('Fanart.tv API error:', error);
    return NextResponse.json({ poster: null });
  }
}
