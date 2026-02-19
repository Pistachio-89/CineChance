---
status: resolved
trigger: "На странице Мои фильмы сломалась пагинация (подгрузка при скролле)"
created: 2026-02-19T13:40:00.000Z
updated: 2026-02-19T13:50:00.000Z
---

## Current Focus

**CORRECTED FIX** - The previous two fix attempts were incomplete. This is the proper solution.

## Symptoms

**Original Issue (before any fixes):**
- Only first 20 movies load
- Nothing happens when scrolling

**After First Fix (05083f1):**
- Regression: Only 1 additional movie loads
- "More" button appears (shouldn't be on infinite scroll)
- Loader flickers

**After Second Fix (d6edbac - WRONG):**
- Reverted to original bug pattern
- Still only 20 movies load

**After Correct Fix (612ea8e):**
- Infinite scroll works correctly
- No "More" button appears
- Loads 20 movies per page

## Root Cause Analysis

The My Movies API has a unique architecture:
1. DB query fetches records (status/tags in WHERE clause)
2. Fetches TMDB data for each record
3. **Applies filters in JavaScript** (types, year, rating, genres)
4. Sorts and paginates

The hasMore calculation needs different logic:
- **Without filters**: DB returned full batch (21 records) = more exist → `watchListRecords.length > limit`
- **With filters**: Check filtered result → `sortedMovies.length > pageEndIndex`

Previous fixes:
- First fix: Always used raw DB count → caused button to appear (wrong)
- Second fix: Always used filtered count → returned to original bug (wrong)
- Correct fix: Check if filters are applied, use appropriate logic

## The Fix

```typescript
// Determine if any JavaScript filters are applied
const hasFilters = (
  (typesParam && typesParam !== 'all' && typesParam.trim() !== '') ||
  (yearFrom || yearTo) ||
  (minRating !== null || maxRating !== null) ||
  (genresParam)
);

// hasMore: If filters applied, check filtered result. If no filters, check raw DB.
const hasMore = hasFilters 
  ? sortedMovies.length > pageEndIndex 
  : watchListRecords.length > limit;
```

## Files Changed

- `src/app/api/my-movies/route.ts` - Lines ~412-425

## Commit

`612ea8e` - fix: correct hasMore logic for My Movies pagination
