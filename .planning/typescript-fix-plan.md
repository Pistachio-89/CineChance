# Plan: Fix Remaining TypeScript Errors

## Current State
- ESLint: ✅ 0 errors, 0 warnings
- TypeScript: ⚠️ ~120 errors

## Error Categories

### 1. Prisma JSON Fields (30 errors)
**Pattern:** `Type 'unknown' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'`

**Solution:** Cast to `any` for JSON fields

**Files:**
- `src/app/api/recommendations/events/route.ts`
- `src/app/api/recommendations/filter-sessions/route.ts`
- `src/app/api/recommendations/negative-feedback/route.ts`
- `src/app/api/recommendations/predictions/route.ts`
- `src/app/api/recommendations/random/route.ts`
- `src/app/api/recommendations/signals/route.ts`
- `src/app/api/recommendations/user-sessions/route.ts`

### 2. Unknown Types in Components (35 errors)
**Pattern:** `'tag' is of type 'unknown'`, `'actor' is of type 'unknown'`, `'collection' is of type 'unknown'`

**Solution:** Add proper type annotations or cast to `any`

**Files:**
- `src/app/my-movies/MyMoviesContentClient.tsx` (3 errors - tag)
- `src/app/profile/actors/ActorsClient.tsx` (4 errors - actor)
- `src/app/profile/collections/CollectionsClient.tsx` (3 errors - collection)
- `src/app/stats/tags/[tagId]/TagDetailClient.tsx` (6 errors - tag)
- `src/app/stats/ratings/[rating]/RatingDetailClient.tsx` (6 errors - tag)
- `src/app/stats/genres/[genre]/GenreDetailClient.tsx` (6 errors - tag)
- `src/app/movie-history/page.tsx` (7 errors - entry)

### 3. Object Property Access (25 errors)
**Pattern:** `Property 'X' does not exist on type '{}'`

**Solution:** Add type assertion or define interface

**Files:**
- `src/app/search/MovieList.tsx` (6 errors)
- `src/app/search/SearchClient.tsx` (1 error)
- `src/app/api/movies/batch/route.ts` (8 errors)
- `src/app/api/movie-tags/route.ts` (2 errors)

### 4. Never Type Issues (30 errors)
**Pattern:** `Property 'X' does not exist on type 'never'`

**Solution:** Fix generic type inference in map/filter callbacks

**Files:**
- `src/app/api/stats/movies-by-genre/route.ts` (10 errors)
- `src/app/api/stats/movies-by-rating/route.ts` (10 errors)
- `src/app/api/stats/movies-by-tag/route.ts` (10 errors)

## Execution Tasks

### Task 1: Fix Prisma JSON Fields
```bash
# Replace 'as unknown' with 'as any' for eventData fields
cd src/app/api/recommendations
sed -i 's/as unknown/as any/g' $(find . -name "*.ts")
```

### Task 2: Fix Component Type Issues
Add explicit types to map callbacks in components:

**MyMoviesContentClient.tsx:**
- Line 71-73: Add type for `tag` parameter

**TagDetailClient.tsx, RatingDetailClient.tsx, GenreDetailClient.tsx:**
- Similar fix for `tag` parameter

### Task 3: Fix Batch Route Types
Add proper type for batch response data

### Task 4: Fix Never Type Inference
Add explicit return types to helper functions

### Task 5: Fix Remaining Small Issues
- `src/hooks/useCollections.ts` - URLSearchParams type
- `src/app/recommendations/FilterStateManager.tsx` - length property
- `src/app/recommendations/useDebounce.ts` - generic type

## Verification
```bash
npx tsc --noEmit 2>&1 | wc -l
# Should be 0 or minimal
```
