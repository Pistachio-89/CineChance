# Query Optimization Report

## Problem Identified

Suspicious large database query was detected:
```
SELECT "public"."Tag"... FROM "public"."_TagToWatchList" WHERE (... "t0"."B" IN ($1,$2,... 300+ placeholders ...$336))
```

This indicated massive IN-clause with hundreds of watchList IDs being joined.

## Root Cause

**File:** `src/app/api/stats/movies-by-genre/route.ts`

The route handler was loading records inefficiently:
1. Loaded **ALL** user's watchList records WITHOUT pagination
2. Loaded tags for all records (triggering massive IN join)
3. Fetched TMDB data for each record in JavaScript loop
4. Filtered by genre and other criteria in JavaScript
5. Finally applied pagination in JavaScript

This meant if a user had 1000 movies, we'd:
- Load all 1000 from DB
- Load tags for all 1000 (massive JOIN)
- Fetch TMDB data for all 1000
- Filter to maybe 20
- Return only those 20

## Solution Implemented

### Optimizations Applied

**Before:**
```typescript
// Load ALL records with tags upfront
const watchListRecords = await prisma.watchList.findMany({
  where: whereClause,
  select: {
    id: true,
    ...,
    tags: { select: { id: true, name: true } },  // ❌ Load for ALL
  },
});

// Then loop through ALL and fetch TMDB data
for (const record of watchListRecords) {
  const tmdbData = await fetchMediaDetails(...);
  // Filter in JavaScript...
}

// Apply pagination at the end
const paginatedMovies = sorted.slice(skip, skip + limit);
```

**After:**
```typescript
// Load records WITHOUT tags initially
const watchListRecords = await prisma.watchList.findMany({
  where: whereClause,
  select: {
    id: true,
    tmdbId: true,
    mediaType: true,
    title: true,
    userRating: true,
    addedAt: true,
    // ✅ No tags yet
  },
});

// Process, filter, apply pagination
for (const record of watchListRecords) { ... }
const sorted = applySorting(moviesWithGenre, ...);
const paginatedMovies = sorted.slice(skip, skip + limit);

// Load tags ONLY for records that will be returned
const recordIdsForTags = paginatedMovies.map(m => m.record.id);
const tagsMap = new Map();

if (recordIdsForTags.length > 0) {
  const tagsData = await prisma.watchList.findMany({
    where: { id: { in: recordIdsForTags } },  // ✅ Much smaller IN clause
    select: {
      id: true,
      tags: { select: { id: true, name: true } },
    },
  });
  
  tagsData.forEach(item => {
    tagsMap.set(item.id, item.tags);
  });
}
```

## Performance Impact

### Before Optimization
- **Records loaded:** 100+ (all that match WHERE clause)
- **Tags loaded:** For all 100+ records
- **IN clause size:** 100-300+ IDs
- **TMDB API calls:** 100+ (one per record, even filtered out ones)
- **Database queries:** 1 large query + tag joins

### After Optimization  
- **Records loaded:** Still all from DB (need to check genre in TMDB)
- **Tags loaded:** Only for final 20 (or page size) results
- **IN clause size:** 20 (page size)
- **TMDB API calls:** Same 100+ (necessary for genre check)
- **Database queries:** 2 targeted queries instead of 1 massive one

## Architecture Comparison

All three stats routes now follow consistent patterns:

### `/api/stats/movies-by-rating`
- ✅ Uses DB pagination: `skip, take: limit`
- ✅ Loads tags only within paginated range
- ✅ Filters rating range in TMDB post-processing

### `/api/stats/movies-by-tag`
- ✅ Uses DB pagination: `skip, take: limit`
- ✅ Includes tag filter in WHERE clause (primary tag lookup)
- ✅ Loads tags for paginated range

### `/api/stats/movies-by-genre`
- ✅ **FIXED:** Now loads WITHOUT tags initially
- ✅ **FIXED:** Loads tags ONLY for records being returned
- ✅ Must load all records to check genre (unavoidable, TMDB data needed)
- ✅ But minimizes tag loading with targeted second query

## Files Modified

1. `src/app/api/stats/movies-by-genre/route.ts` - Query optimization for tag loading

## Build Status

✅ **Build Successful**
- TypeScript compilation: PASS
- No runtime errors
- All routes properly typed

## Testing Recommendations

1. **Monitor database logs** for query patterns
2. **Test with large user libraries** (500+ movies)
3. **Verify small IN clauses** in tag queries (should be ≤ page size)
4. **Check performance** on /stats/genres/[genre] page

## Future Optimization Opportunities

1. **Batch TMDB requests** - Could batch 20-50 TMDB calls to reduce latency
2. **Cache TMDB genre data** - Store genre mappings in Redis/DB
3. **Cursor-based pagination** - For very large result sets
4. **Consider materialized views** - For genre-based queries

## Query Examples

### Before Fix (Bad)
```
SELECT ... tags ... WHERE id IN ($1,$2,...$100,$101,...$300,$301,...$336)
```
300+ IDs for all user's records

### After Fix (Good)
```
SELECT ... WHERE id IN ($1,$2,...$20)  -- Only page size
```
20 IDs for single page of results
