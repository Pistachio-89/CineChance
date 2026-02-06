// src/app/api/my-movies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MOVIE_STATUS_IDS, getStatusIdByName, getStatusNameById } from '@/lib/movieStatusConstants';
import { calculateCineChanceScore } from '@/lib/calculateCineChanceScore';

const ITEMS_PER_PAGE = 20;

// Helper function to get TMDB details
async function fetchMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=ru-RU`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      next: { revalidate: 86400 },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

// Helper function to get CineChance ratings
async function fetchCineChanceRatings(tmdbIds: number[]) {
  if (tmdbIds.length === 0) return new Map();

  const watchlistRecords = await prisma.watchList.groupBy({
    by: ['tmdbId'],
    _avg: { userRating: true },
    _count: { userRating: true },
    where: { tmdbId: { in: tmdbIds }, userRating: { not: null } },
  });

  const ratingsMap = new Map<number, { averageRating: number; count: number }>();
  watchlistRecords.forEach(record => {
    if (record._avg.userRating && record._count.userRating > 0) {
      ratingsMap.set(record.tmdbId, {
        averageRating: record._avg.userRating,
        count: record._count.userRating,
      });
    }
  });
  return ratingsMap;
}

// Helper function to check if movie is anime
function isAnime(movie: any): boolean {
  // Может быть genre_ids (массив чисел) или genres (массив объектов)
  let hasAnimeGenre = false;
  
  if (Array.isArray(movie.genre_ids)) {
    hasAnimeGenre = movie.genre_ids.includes(16);
  } else if (Array.isArray(movie.genres)) {
    hasAnimeGenre = movie.genres.some((g: any) => g.id === 16);
  }
  
  return hasAnimeGenre && movie.original_language === 'ja';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(ITEMS_PER_PAGE));
    const sortBy = searchParams.get('sortBy') || 'rating';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const statusNameParam = searchParams.get('statusName');
    const includeHidden = searchParams.get('includeHidden') === 'true';

    // Parse filters
    const typesParam = searchParams.get('types');
    const yearFrom = searchParams.get('yearFrom');
    const yearTo = searchParams.get('yearTo');
    const minRating = parseFloat(searchParams.get('minRating') || '0');
    const maxRating = parseFloat(searchParams.get('maxRating') || '10');
    const genresParam = searchParams.get('genres');
    const tagsParam = searchParams.get('tags');

    // Build where clause
    const whereClause: any = { userId };

    if (statusNameParam) {
      const statusNames = statusNameParam.split(',');
      const statusIds = statusNames.map(name => getStatusIdByName(name)).filter(id => id !== null) as number[];
      if (statusIds.length > 0) {
        whereClause.statusId = { in: statusIds };
      }
    }

    // Add tag filter to WHERE clause for efficient database filtering
    if (tagsParam) {
      const tagIds = tagsParam.split(',');
      whereClause.tags = {
        some: {
          id: { in: tagIds }
        }
      };
    }

    // Calculate records to load based on filters
    const hasTypeFilters = typesParam && typesParam.split(',').length < 3;
    const hasOtherFilters = genresParam || yearFrom || yearTo || (minRating > 0 || maxRating < 10);
    
    let recordsToLoad = limit + 1;
    if (hasTypeFilters) {
      recordsToLoad = limit * 10; // 10x multiplier for type filters
    } else if (hasOtherFilters) {
      recordsToLoad = limit * 5; // 5x multiplier for other filters
    }
    recordsToLoad = Math.min(recordsToLoad, 500);

    if (includeHidden) {
      // For hidden tab, we use blacklist
      const skip = (page - 1) * recordsToLoad;
      const take = recordsToLoad;

      // Count total
      const totalCount = await prisma.blacklist.count({ where: { userId } });

      // Get records
      const blacklistRecords = await prisma.blacklist.findMany({
        where: { userId },
        select: { tmdbId: true, mediaType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });

      // Get ratings
      const tmdbIds = blacklistRecords.map(r => r.tmdbId);
      const ratingsMap = await fetchCineChanceRatings(tmdbIds);

      // Fetch TMDB data
      const moviesWithDetails = await Promise.all(
        blacklistRecords.map(async (record) => {
          // ИСПРАВЛЕНИЕ 1: Добавлено "as 'movie' | 'tv'"
          const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');
          const cineChanceData = ratingsMap.get(record.tmdbId);

          return {
            record,
            tmdbData,
            cineChanceData,
            isAnime: tmdbData ? isAnime(tmdbData) : false,
          };
        })
      );

      // Filter movies
      const filteredMovies = moviesWithDetails.filter(({ record, tmdbData, isAnime }) => {
        if (!tmdbData) return false;

        // Type filter
        if (typesParam) {
          const types = typesParam.split(',');
          if (isAnime) {
            if (!types.includes('anime')) return false;
          } else if (record.mediaType === 'movie') {
            if (!types.includes('movie')) return false;
          } else if (record.mediaType === 'tv') {
            if (!types.includes('tv')) return false;
          }
        }

        // Year filter
        const releaseYear = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
        if (yearFrom && parseInt(releaseYear) < parseInt(yearFrom)) return false;
        if (yearTo && parseInt(releaseYear) > parseInt(yearTo)) return false;

        return true;
      });

      // Transform to output format
      const movies = filteredMovies.map(({ record, tmdbData, cineChanceData }) => {
        const cineChanceRating = cineChanceData?.averageRating || null;
        const cineChanceVotes = cineChanceData?.count || 0;

        const combinedRating = calculateCineChanceScore({
          tmdbRating: tmdbData?.vote_average || 0,
          tmdbVotes: tmdbData?.vote_count || 0,
          cineChanceRating,
          cineChanceVotes,
        });

        return {
          id: record.tmdbId,
          media_type: record.mediaType as 'movie' | 'tv',
          title: tmdbData?.title || tmdbData?.name || 'Без названия',
          name: tmdbData?.title || tmdbData?.name || 'Без названия',
          poster_path: tmdbData?.poster_path || null,
          vote_average: tmdbData?.vote_average || 0,
          vote_count: tmdbData?.vote_count || 0,
          release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
          first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
          overview: tmdbData?.overview || '',
          genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
          original_language: tmdbData?.original_language || '',
          combinedRating,
          averageRating: cineChanceRating,
          ratingCount: cineChanceVotes,
          addedAt: record.createdAt?.toISOString() || '',
          userRating: null,
          isBlacklisted: true,
        };
      });

      // Sort movies
      const sortedMovies = sortMovies(movies, sortBy, sortOrder);

      // Пагинация отфильтрованных результатов
      const pageStartIndex = (page - 1) * limit;
      const pageEndIndex = pageStartIndex + limit;
      const paginatedMovies = sortedMovies.slice(pageStartIndex, pageEndIndex);
      const hasMore = sortedMovies.length > pageEndIndex;

      return NextResponse.json({
        movies: paginatedMovies,
        hasMore,
        totalCount: sortedMovies.length,
      });
    }

    // For regular tabs (watched, wantToWatch, dropped)
    // First count total
    const totalCount = await prisma.watchList.count({ where: whereClause });

    // Setup pagination for regular tabs
    const skip = (page - 1) * recordsToLoad;
    const take = recordsToLoad;

    const watchListRecords = await prisma.watchList.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        mediaType: true,
        title: true,
        voteAverage: true,
        userRating: true,
        weightedRating: true, // Добавляем взвешенную оценку
        addedAt: true,
        statusId: true,
        tags: { select: { id: true, name: true } },
      },
      orderBy: { addedAt: 'desc' },
      skip,
      take,
    });

    // Get ratings for current page only
    const tmdbIds = watchListRecords.map(r => r.tmdbId);
    const ratingsMap = await fetchCineChanceRatings(tmdbIds);

    // Fetch TMDB data for current page
    const moviesWithDetails = await Promise.all(
      watchListRecords.map(async (record) => {
        // ИСПРАВЛЕНИЕ 2: Добавлено "as 'movie' | 'tv'"
        const tmdbData = await fetchMediaDetails(record.tmdbId, record.mediaType as 'movie' | 'tv');
        const cineChanceData = ratingsMap.get(record.tmdbId);

        return {
          record,
          tmdbData,
          cineChanceData,
          isAnime: tmdbData ? isAnime(tmdbData) : false,
        };
      })
    );

    // Filter movies
    const filteredMovies = moviesWithDetails.filter(({ record, tmdbData, isAnime }) => {
      if (!tmdbData) return false;

      // Type filter
      if (typesParam) {
        const types = typesParam.split(',');
        if (isAnime) {
          if (!types.includes('anime')) return false;
        } else if (record.mediaType === 'movie') {
          if (!types.includes('movie')) return false;
        } else if (record.mediaType === 'tv') {
          if (!types.includes('tv')) return false;
        }
      }

      // Year filter
      const releaseYear = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
      if (yearFrom && parseInt(releaseYear) < parseInt(yearFrom)) return false;
      if (yearTo && parseInt(releaseYear) > parseInt(yearTo)) return false;

      // Rating filter - use userRating from watchList
      const userRating = watchListRecords.find(r => r.tmdbId === tmdbData.id)?.userRating;
      // Only apply rating filter if userRating is not null
      if (userRating !== null && userRating !== undefined) {
        if (userRating < minRating || userRating > maxRating) return false;
      }

      // Genre filter
      if (genresParam) {
        const genreIds = genresParam.split(',').map(Number);
        const movieGenres = tmdbData.genres?.map((g: any) => g.id) || [];
        const hasMatchingGenre = genreIds.some(genreId => movieGenres.includes(genreId));
        if (!hasMatchingGenre) return false;
      }

      // Tags filter is now handled at DB level via Prisma WHERE clause, no need to filter in memory

      return true;
    });

    // Transform to output format
    const movies = filteredMovies.map(({ record, tmdbData, cineChanceData }) => {
      const cineChanceRating = cineChanceData?.averageRating || null;
      const cineChanceVotes = cineChanceData?.count || 0;

      const combinedRating = calculateCineChanceScore({
        tmdbRating: tmdbData?.vote_average || 0,
        tmdbVotes: tmdbData?.vote_count || 0,
        cineChanceRating,
        cineChanceVotes,
      });

      return {
        id: record.tmdbId,
        media_type: record.mediaType as 'movie' | 'tv',
        title: record.title,
        name: record.title,
        poster_path: tmdbData?.poster_path || null,
        vote_average: tmdbData?.vote_average || 0,
        vote_count: tmdbData?.vote_count || 0,
        release_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        first_air_date: tmdbData?.release_date || tmdbData?.first_air_date || '',
        overview: tmdbData?.overview || '',
        genre_ids: tmdbData?.genres?.map((g: any) => g.id) || [],
        original_language: tmdbData?.original_language || '',
        statusName: getStatusNameById(record.statusId) || 'Unknown',
        combinedRating,
        averageRating: cineChanceRating,
        ratingCount: cineChanceVotes,
        addedAt: record.addedAt?.toISOString() || '',
        userRating: record.weightedRating ?? record.userRating, // Fallback на взвешенную оценку
        tags: record.tags || [],
      };
    });

    // Sort movies
    const sortedMovies = sortMovies(movies, sortBy, sortOrder);



    // Пагинация отфильтрованных результатов
    const pageStartIndex = (page - 1) * limit;
    const pageEndIndex = pageStartIndex + limit;
    const paginatedMovies = sortedMovies.slice(pageStartIndex, pageEndIndex);
    const hasMore = sortedMovies.length > pageEndIndex;



    return NextResponse.json({
      movies: paginatedMovies,
      hasMore,
      totalCount: sortedMovies.length,
    });
  } catch (error) {
    console.error('Error fetching my movies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function sortMovies(
  movies: any[],
  sortBy: string,
  sortOrder: string
): any[] {
  return [...movies].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'popularity':
        comparison = b.vote_count - a.vote_count;
        break;
      case 'rating':
        const ratingA = a.combinedRating ?? a.vote_average;
        const ratingB = b.combinedRating ?? b.vote_average;
        comparison = ratingB - ratingA;
        break;
      case 'date':
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        comparison = dateB.localeCompare(dateA);
        break;
      case 'savedDate':
        const savedA = a.addedAt || '';
        const savedB = b.addedAt || '';
        comparison = savedB.localeCompare(savedA);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? comparison : -comparison;
  });
}