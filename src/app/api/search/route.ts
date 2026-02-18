import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isUnder18 } from '@/lib/age-utils';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/middleware/rateLimit';

export async function GET(request: Request) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, '/api/search');
  if (!rateLimitResult.success) {
    const resetTime = new Date(rateLimitResult.reset);
    const waitSeconds = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    return NextResponse.json(
      { 
        error: 'Слишком много запросов. Пожалуйста, подождите минуту перед следующим поиском.',
        retryAfter: Math.max(1, waitSeconds),
        resetTime: resetTime.toISOString()
      }, 
      { status: 429 }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // Filter parameters
  const type = searchParams.get('type') || 'all';
  const yearFrom = searchParams.get('yearFrom') || '';
  const yearTo = searchParams.get('yearTo') || '';
  const quickYear = searchParams.get('quickYear') || '';
  const genresParam = searchParams.get('genres') || '';
  const ratingFrom = parseFloat(searchParams.get('ratingFrom') || '0');
  const ratingTo = parseFloat(searchParams.get('ratingTo') || '10');
  const sortBy = searchParams.get('sortBy') || 'popularity';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const listStatus = searchParams.get('listStatus') || 'all';

  // If no query and no filters, return empty
  const hasFilters = query || type !== 'all' || yearFrom || yearTo || quickYear || genresParam || ratingFrom > 0 || ratingTo < 10 || listStatus !== 'all';
  if (!hasFilters) {
    return NextResponse.json({ results: [], totalPages: 1, totalResults: 0 });
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    
    if (!apiKey) {
      logger.error('TMDB API key is missing');
      return NextResponse.json({ error: 'Search service unavailable' }, { status: 500 });
    }
    
    let allResults: any[] = [];
    let totalResults = 0;
    let totalPages = 1;

    // Проверяем возраст пользователя для фильтрации взрослого контента
    const session = await getServerSession(authOptions);
    let shouldFilterAdult = true; // По умолчанию фильтруем для незалогиненных пользователей

    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { birthDate: true },
      });

      if (user?.birthDate) {
        shouldFilterAdult = isUnder18(user.birthDate);
      }
    }

    if (query) {
      // Запрашиваем больше данных с TMDB для пагинации
      // Получаем несколько страниц, чтобы обеспечить нужное количество для пагинации
      const pagesToFetch = Math.ceil((page * limit) / 20) + 1; // +1 для запаса
      
      // Создаём массив промисов для параллельной загрузки страниц
      const fetchPromises = [];
      for (let apiPage = 1; apiPage <= pagesToFetch; apiPage++) {
        const url = new URL(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=ru-RU&page=${apiPage}&include_adult=${!shouldFilterAdult}`);
        url.searchParams.set('query', query);

        const promise = fetch(url.toString(), { next: { revalidate: 3600 } })
          .then(async res => {
            if (!res.ok) {
              throw new Error(`TMDB API error: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            if (data.status_code) {
              throw new Error(`TMDB API error: ${data.status_message}`);
            }
            return data;
          })
          .catch(error => ({ error, page: apiPage })); // В случае ошибки возвращаем объект с ошибкой
        fetchPromises.push(promise);
      }

      // Выполняем все запросы параллельно
      const results = await Promise.allSettled(fetchPromises);

      // Собираем результаты, игнорируя ошибки
      let hasErrors = false;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            logger.error('TMDB API fetch error', { 
              error: result.value.error.message || result.value.error,
              page: result.value.page,
              query 
            });
            hasErrors = true;
          } else if (result.value.results && result.value.results.length > 0) {
            allResults = allResults.concat(result.value.results);
          }
        } else {
          logger.error('Promise rejected', { 
            error: result.reason,
            query 
          });
          hasErrors = true;
        }
      }

      // Если все запросы завершились с ошибками, возвращаем пустой результат
      if (hasErrors && allResults.length === 0) {
        logger.warn('All TMDB API requests failed', { query });
        return NextResponse.json({ 
          results: [], 
          totalPages: 1, 
          totalResults: 0,
          error: 'Search temporarily unavailable' 
        });
      }

      // Дополнительная серверная фильтрация на случай, если TMDB не применил настройки
      if (shouldFilterAdult) {
        allResults = allResults.filter((item: any) => !item.adult);
      }

      // Filter results based on type
      const typeParam = type || 'all';
      const selectedTypes = typeParam.split(',');
      
      if (selectedTypes.length > 0 && !selectedTypes.includes('all')) {
        // Filter by multiple types
        allResults = allResults.filter((item: any) => {
          const itemType = item.media_type;
          const isAnime = (item.genre_ids?.includes(16) ?? false) && item.original_language === 'ja';
          const isCartoon = (item.genre_ids?.includes(16) ?? false) && item.original_language !== 'ja';
          
          // Check if this item matches any selected type
          for (const t of selectedTypes) {
            if (t === 'anime' && isAnime) return true;
            if (t === 'cartoon' && isCartoon) return true;
            if (t === 'movie' && itemType === 'movie' && !isAnime && !isCartoon) return true;
            if (t === 'tv' && itemType === 'tv' && !isAnime && !isCartoon) return true;
          }
          return false;
        });
      }

      // Filter by list status
      if (listStatus !== 'all') {
        const listSession = await getServerSession(authOptions);
        
        if (listSession?.user?.id) {
          // Оптимизированные запросы - загружаем только необходимые поля
          // Get user's watchlist
          const watchlist = await prisma.watchList.findMany({
            where: { userId: listSession.user.id as string },
            select: {
              tmdbId: true,
              mediaType: true,
              statusId: true,
            },
          });
          
          // Get user's blacklist
          const blacklist = await prisma.blacklist.findMany({
            where: { userId: listSession.user.id as string },
            select: { tmdbId: true },
          });

          // Create maps for quick lookup
          const watchlistMap = new Map<number, { statusId: number; mediaType: string }>();
          watchlist.forEach(item => {
            watchlistMap.set(item.tmdbId, { 
              statusId: item.statusId, 
              mediaType: item.mediaType 
            });
          });
          
          const blacklistSet = new Set<number>();
          blacklist.forEach(item => blacklistSet.add(item.tmdbId));

          // Map API media_type to database mediaType
          const getDbMediaType = (apiType: string) => {
            if (apiType === 'movie') return 'movie';
            if (apiType === 'tv') return 'tv';
            return apiType; // 'person' etc.
          };

          allResults = allResults.filter((item: any) => {
            const watchlistItem = watchlistMap.get(item.id);
            const isBlacklisted = blacklistSet.has(item.id);
            const dbMediaType = getDbMediaType(item.media_type);

            // Check if item is in watchlist with matching media type
            const isInWatchlist = watchlistItem && watchlistItem.mediaType === dbMediaType;

            switch (listStatus) {
              case 'notInList':
                // Не в списках = не в watchlist И не в blacklist
                return !isInWatchlist && !isBlacklisted;
              
              case 'wantToWatch':
                // В списке "Хочу посмотреть"
                return isInWatchlist && watchlistItem.statusId === 1;
              
              case 'watched':
                // В списке "Просмотрено"
                return isInWatchlist && watchlistItem.statusId === 2;
              
              case 'dropped':
                // В списке "Брошено"
                return isInWatchlist && watchlistItem.statusId === 3;
              
              default:
                return true;
            }
          });
        }
      }

      // Filter by year
      let yearFilter = '';
      if (quickYear === '2020s') yearFilter = '2020-2029';
      else if (quickYear === '2010s') yearFilter = '2010-2019';
      else if (quickYear === '2000s') yearFilter = '2000-2009';
      else if (quickYear === '1990s') yearFilter = '1990-1999';
      else if (quickYear === '1980s') yearFilter = '1980-1989';
      else if (quickYear === '1970s') yearFilter = '1970-1979';
      else if (quickYear === '1960s') yearFilter = '1960-1969';
      else if (quickYear) yearFilter = quickYear;

      if (yearFilter) {
        const yearMatch = yearFilter.match(/(\d{4})(?:-(\d{4}))?/);
        if (yearMatch) {
          const y1 = parseInt(yearMatch[1]);
          const y2 = yearMatch[2] ? parseInt(yearMatch[2]) : y1;
          allResults = allResults.filter((item: any) => {
            const releaseDate = item.release_date || item.first_air_date || '';
            const year = parseInt(releaseDate.split('-')[0]) || 0;
            return year >= y1 && year <= y2;
          });
        }
      }

      if (yearFrom) {
        const yFrom = parseInt(yearFrom);
        allResults = allResults.filter((item: any) => {
          const releaseDate = item.release_date || item.first_air_date || '';
          const year = parseInt(releaseDate.split('-')[0]) || 0;
          return year >= yFrom;
        });
      }

      if (yearTo) {
        const yTo = parseInt(yearTo);
        allResults = allResults.filter((item: any) => {
          const releaseDate = item.release_date || item.first_air_date || '';
          const year = parseInt(releaseDate.split('-')[0]) || 0;
          return year <= yTo;
        });
      }

      // Filter by genres
      if (genresParam) {
        const genreIds = genresParam.split(',').map(Number).filter(n => !isNaN(n));
        if (genreIds.length > 0) {
          allResults = allResults.filter((item: any) => {
            const itemGenres = item.genre_ids || [];
            return genreIds.some((gid: number) => itemGenres.includes(gid));
          });
        }
      }

      // Filter by rating
      if (ratingFrom > 0 || ratingTo < 10) {
        allResults = allResults.filter((item: any) => {
          const rating = item.vote_average || 0;
          return rating >= ratingFrom && rating <= ratingTo;
        });
      }

      // Sort results
      if (sortBy !== 'popularity') {
        allResults.sort((a: any, b: any) => {
          const aVal = a.vote_average || 0;
          const bVal = b.vote_average || 0;
          const aDate = parseInt((a.release_date || a.first_air_date || '0').split('-')[0]) || 0;
          const bDate = parseInt((b.release_date || b.first_air_date || '0').split('-')[0]) || 0;

          let comparison = 0;
          if (sortBy === 'rating') comparison = aVal - bVal;
          else if (sortBy === 'date') comparison = aDate - bDate;

          return sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Deduplicate results by media_type and id
      const seen = new Set();
      allResults = allResults.filter((item: any) => {
        const key = `${item.media_type}_${item.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      totalResults = allResults.length;
      totalPages = Math.ceil(totalResults / limit);

      // Apply pagination to filtered results
      const startIndex = (page - 1) * limit;
      const paginatedResults = allResults.slice(startIndex, startIndex + limit);

      return NextResponse.json({
        results: paginatedResults,
        totalPages,
        totalResults
      });

    } else {
      // No query, use discover endpoint with filters
      const pagesToFetch = Math.ceil((page * limit) / 20) + 1;
      let discoverResults: any[] = [];

      // Determine API endpoints and filters based on type
      const typeParam = type || 'all';
      const selectedTypes = typeParam !== 'all' ? typeParam.split(',') : [];
      
      // Track what we need
      const includeAnime = selectedTypes.includes('anime');
      const includeCartoon = selectedTypes.includes('cartoon');
      const includeMovies = selectedTypes.length === 0 || selectedTypes.includes('movie');
      const includeTv = selectedTypes.length === 0 || selectedTypes.includes('tv');

      // Helper function to build genre filter properly
      const buildGenreFilter = (isAnimeFilter: boolean): string => {
        const genreIds: number[] = [];
        
        // Add selected genres
        if (genresParam) {
          genresParam.split(',').forEach(id => {
            const num = parseInt(id);
            if (!isNaN(num)) genreIds.push(num);
          });
        }
        
        // Add anime genre if needed
        if (isAnimeFilter && !genreIds.includes(16)) {
          genreIds.push(16); // Animation genre
        }
        
        return genreIds.length > 0 ? genreIds.join('|') : '';
      };

      // Determine which endpoints to query
      // Always query both movie and tv if needed, filter anime separately
      const queryMovie = includeMovies || selectedTypes.length === 0;
      const queryTv = includeTv || selectedTypes.length === 0;

      // Fetch from movie endpoint if needed
      if (queryMovie) {
        for (let apiPage = 1; apiPage <= pagesToFetch; apiPage++) {
          // Динамически устанавливаем include_adult в зависимости от возраста пользователя
          const discoverUrl = new URL(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=ru-RU&page=${apiPage}&include_adult=${!shouldFilterAdult}`);

          // Add year filters
          let yearFilter = '';
          if (quickYear === '2020s') yearFilter = '2020-2029';
          else if (quickYear === '2010s') yearFilter = '2010-2019';
          else if (quickYear === '2000s') yearFilter = '2000-2009';
          else if (quickYear === '1990s') yearFilter = '1990-1999';
          else if (quickYear === '1980s') yearFilter = '1980-1989';
          else if (quickYear === '1970s') yearFilter = '1970-1979';
          else if (quickYear === '1960s') yearFilter = '1960-1969';
          else if (quickYear) yearFilter = quickYear;

          if (yearFrom) discoverUrl.searchParams.set('primary_release_date.gte', `${yearFrom}-01-01`);
          if (yearTo) discoverUrl.searchParams.set('primary_release_date.lte', `${yearTo}-12-31`);
          if (yearFilter && !yearFrom && !yearTo) {
            const yearMatch = yearFilter.match(/(\d{4})(?:-(\d{4}))?/);
            if (yearMatch) {
              discoverUrl.searchParams.set('primary_release_date.gte', `${yearMatch[1]}-01-01`);
              discoverUrl.searchParams.set('primary_release_date.lte', `${yearMatch[2] || yearMatch[1]}-12-31`);
            }
          }

          // Add genre filters
          if (genresParam) {
            const genreIds = genresParam.split(',').map(Number).filter(n => !isNaN(n));
            if (genreIds.length > 0) {
              discoverUrl.searchParams.set('with_genres', genreIds.join('|'));
            }
          }

          // Add rating filter
          if (ratingFrom > 0) {
            discoverUrl.searchParams.set('vote_average.gte', String(ratingFrom));
          }

          // Add rating upper bound filter (client-side, TMDB doesn't support it)
          if (ratingTo < 10) {
            // Will be filtered after fetching
          }

          // Add sort
          let sortParam = 'popularity.desc';
          if (sortBy === 'rating') sortParam = `vote_average.${sortOrder}`;
          else if (sortBy === 'date') sortParam = `primary_release_date.${sortOrder}`;
          discoverUrl.searchParams.set('sort_by', sortParam);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const res = await fetch(discoverUrl.toString(), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            throw new Error(`TMDB discover API error: ${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          
          if (data.status_code) {
            throw new Error(`TMDB discover API error: ${data.status_message}`);
          }

          if (data.results && data.results.length > 0) {
            // Filter out anime and cartoon from movie results
            const filteredResults = data.results.filter((item: any) => {
              const isAnime = (item.genre_ids?.includes(16) ?? false) && item.original_language === 'ja';
              const isCartoon = (item.genre_ids?.includes(16) ?? false) && item.original_language !== 'ja';
              return (!isAnime || includeAnime) && (!isCartoon || includeCartoon);
            });
            discoverResults = discoverResults.concat(filteredResults);
          } else {
            break;
          }
        }
      }

      // Fetch from tv endpoint if needed
      if (queryTv) {
        for (let apiPage = 1; apiPage <= pagesToFetch; apiPage++) {
          // Динамически устанавливаем include_adult в зависимости от возраста пользователя
          const discoverUrl = new URL(`https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&language=ru-RU&page=${apiPage}&include_adult=${!shouldFilterAdult}`);

          // Add year filters
          let yearFilter = '';
          if (quickYear === '2020s') yearFilter = '2020-2029';
          else if (quickYear === '2010s') yearFilter = '2010-2019';
          else if (quickYear === '2000s') yearFilter = '2000-2009';
          else if (quickYear === '1990s') yearFilter = '1990-1999';
          else if (quickYear === '1980s') yearFilter = '1980-1989';
          else if (quickYear === '1970s') yearFilter = '1970-1979';
          else if (quickYear === '1960s') yearFilter = '1960-1969';
          else if (quickYear) yearFilter = quickYear;

          if (yearFrom) discoverUrl.searchParams.set('first_air_date.gte', `${yearFrom}-01-01`);
          if (yearTo) discoverUrl.searchParams.set('first_air_date.lte', `${yearTo}-12-31`);
          if (yearFilter && !yearFrom && !yearTo) {
            const yearMatch = yearFilter.match(/(\d{4})(?:-(\d{4}))?/);
            if (yearMatch) {
              discoverUrl.searchParams.set('first_air_date.gte', `${yearMatch[1]}-01-01`);
              discoverUrl.searchParams.set('first_air_date.lte', `${yearMatch[2] || yearMatch[1]}-12-31`);
            }
          }

          // Add genre filters - use buildGenreFilter for anime
          const genreFilter = buildGenreFilter(includeAnime);
          if (genreFilter) {
            discoverUrl.searchParams.set('with_genres', genreFilter);
          }

          // Add anime language filter if anime is selected
          if (includeAnime && !includeCartoon) {
            discoverUrl.searchParams.set('with_original_language', 'ja');
          }

          // Add rating filter
          if (ratingFrom > 0) {
            discoverUrl.searchParams.set('vote_average.gte', String(ratingFrom));
          }

          // Add rating upper bound filter (client-side, TMDB doesn't support it)
          if (ratingTo < 10) {
            // Will be filtered after fetching
          }

          // Add sort
          let sortParam = 'popularity.desc';
          if (sortBy === 'rating') sortParam = `vote_average.${sortOrder}`;
          else if (sortBy === 'date') sortParam = `first_air_date.${sortOrder}`;
          discoverUrl.searchParams.set('sort_by', sortParam);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const res = await fetch(discoverUrl.toString(), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            throw new Error(`TMDB TV discover API error: ${res.status} ${res.statusText}`);
          }
          const data = await res.json();
          
          if (data.status_code) {
            throw new Error(`TMDB TV discover API error: ${data.status_message}`);
          }

          if (data.results && data.results.length > 0) {
            discoverResults = discoverResults.concat(data.results);
          } else {
            break;
          }
        }
      }

      // Дополнительная серверная фильтрация на случай, если TMDB не применил настройки
      if (shouldFilterAdult) {
        discoverResults = discoverResults.filter((item: any) => !item.adult);
      }

      // Filter by media type (movies, tv, anime, cartoon) if specific types are selected
      if (selectedTypes.length > 0 && !selectedTypes.includes('all')) {
        discoverResults = discoverResults.filter((item: any) => {
          const itemType = item.media_type;
          const isAnime = (item.genre_ids?.includes(16) ?? false) && item.original_language === 'ja';
          const isCartoon = (item.genre_ids?.includes(16) ?? false) && item.original_language !== 'ja';
          
          for (const t of selectedTypes) {
            if (t === 'anime' && isAnime) return true;
            if (t === 'cartoon' && isCartoon) return true;
            if (t === 'movie' && itemType === 'movie' && !isAnime && !isCartoon) return true;
            if (t === 'tv' && itemType === 'tv' && !isAnime && !isCartoon) return true;
          }
          return false;
        });
      }

      // Deduplicate results by media_type and id
      const seen = new Set();
      discoverResults = discoverResults.filter((item: any) => {
        const key = `${item.media_type}_${item.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      // Filter by rating upper bound (TMDB doesn't support it in discover API)
      if (ratingTo < 10) {
        discoverResults = discoverResults.filter((item: any) => {
          const rating = item.vote_average || 0;
          return rating <= ratingTo;
        });
      }

      totalResults = discoverResults.length;
      totalPages = Math.ceil(totalResults / limit);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedResults = discoverResults.slice(startIndex, startIndex + limit);

      return NextResponse.json({
        results: paginatedResults,
        totalPages,
        totalResults
      });
    }
  } catch (error) {
    logger.error('Search API error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'Search'
    });
    return NextResponse.json({ results: [], totalPages: 1, totalResults: 0 });
  }
}
