import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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
  const sortBy = searchParams.get('sortBy') || 'popularity';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // If no query and no filters, return empty
  if (!query && !type && !yearFrom && !yearTo && !quickYear && !genresParam && !ratingFrom) {
    return NextResponse.json({ results: [], totalPages: 1, totalResults: 0 });
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    let allResults: any[] = [];
    let totalResults = 0;
    let totalPages = 1;

    if (query) {
      // Запрашиваем больше данных с TMDB для пагинации
      // Получаем несколько страниц, чтобы обеспечить нужное количество для пагинации
      const pagesToFetch = Math.ceil((page * limit) / 20) + 1; // +1 для запаса
      
      for (let apiPage = 1; apiPage <= pagesToFetch; apiPage++) {
        const url = new URL(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=ru-RU&page=${apiPage}&include_adult=false`);
        url.searchParams.set('query', query);

        const res = await fetch(url.toString());
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          allResults = allResults.concat(data.results);
        } else {
          break; // Больше нет результатов
        }
      }

      // Filter results based on type
      if (type && type !== 'all') {
        allResults = allResults.filter((item: any) => item.media_type === type);
      }

      // Filter by year
      let yearFilter = '';
      if (quickYear === '2020s') yearFilter = '2020-2029';
      else if (quickYear === '2010s') yearFilter = '2010-2019';
      else if (quickYear === '2000s') yearFilter = '2000-2009';
      else if (quickYear === '1990s') yearFilter = '1990-1999';
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
      if (ratingFrom > 0) {
        allResults = allResults.filter((item: any) => (item.vote_average || 0) >= ratingFrom);
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
      // Для discover API TMDB также ограничивает 20 результатами на страницу
      const pagesToFetch = Math.ceil((page * limit) / 20) + 1;
      let discoverResults: any[] = [];

      for (let apiPage = 1; apiPage <= pagesToFetch; apiPage++) {
        const discoverUrl = new URL(`https://api.themoviedb.org/3/discover/${type === 'tv' ? 'tv' : 'movie'}?api_key=${apiKey}&language=ru-RU&page=${apiPage}&include_adult=false`);

        // Add year filters
        let yearFilter = '';
        if (quickYear === '2020s') yearFilter = '2020-2029';
        else if (quickYear === '2010s') yearFilter = '2010-2019';
        else if (quickYear === '2000s') yearFilter = '2000-2009';
        else if (quickYear === '1990s') yearFilter = '1990-1999';
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

        // Add sort
        let sortParam = 'popularity.desc';
        if (sortBy === 'rating') sortParam = `vote_average.${sortOrder}`;
        else if (sortBy === 'date') sortParam = `primary_release_date.${sortOrder}`;
        discoverUrl.searchParams.set('sort_by', sortParam);

        const res = await fetch(discoverUrl.toString());
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          discoverResults = discoverResults.concat(data.results);
        } else {
          break;
        }
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
    console.error('Search API error:', error);
    return NextResponse.json({ results: [], totalPages: 1, totalResults: 0 });
  }
}
