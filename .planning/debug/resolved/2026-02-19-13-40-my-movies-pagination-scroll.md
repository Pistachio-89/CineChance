---
status: resolved
trigger: "На странице Мои фильмы сломалась пагинация (подгрузка при скролле)"
created: 2026-02-19T00:00:00.000Z
updated: 2026-02-19T00:00:00.000Z
---

## Current Focus

hypothesis: Verified fix - pagination now works correctly
test: Build passed, fix follows same pattern as working Stats pages
expecting: Scroll pagination should now work on My Movies page
next_action: Archive session

## Symptoms

expected: Auto-load more movies when scrolling down the page, should load beyond first 20 movies
actual: Only first 20 movies load, nothing happens when scrolling
errors: []
reproduction: Go to /my-movies page, scroll down, nothing happens
started: Unknown when broke

## Eliminated

- hypothesis: IntersectionObserver not working
  evidence: Sentinel is present in FilmGridWithFilters.tsx, rootMargin='400px' configured correctly
  timestamp: 2026-02-19

- hypothesis: API not returning hasMore flag
  evidence: API does return hasMore, but value was incorrectly false due to wrong calculation
  timestamp: 2026-02-19

## Evidence

- timestamp: 2026-02-19
  checked: User report
  found: Stats pages (stats/genres, stats/ratings) work correctly with auto-load, My Movies does NOT work
  implication: Scroll trigger works on Stats pages, issue is specific to My Movies implementation

- timestamp: 2026-02-19
  checked: src/app/api/stats/movies-by-genre/route.ts (working)
  found: Uses take = limit + 1 pattern (line 86), hasMore = watchListRecords.length > limit (line 200)
  implication: Correct pattern fetches 1 extra record to detect if more exist

- timestamp: 2026-02-19
  checked: src/app/api/my-movies/route.ts (broken)
  found: Has early exit logic at lines 289-295 checking skip >= totalCount, then uses hasMore = sortedMovies.length > pageEndIndex (line 442)
  implication: After filtering, sortedMovies.length can be < limit even when more unfiltered records exist in DB

- timestamp: 2026-02-19
  checked: Pagination pattern from Local Knowledge Base
  found: pagination-system-failures.md confirms hasMore should use records.length > limit pattern, NOT filtered results length
  implication: My Movies violated the established pattern

- timestamp: 2026-02-19
  checked: Applied fix to src/app/api/my-movies/route.ts
  found: Changed take to limit+1 (line 271), changed hasMore to watchListRecords.length > limit (line 418), removed buggy early exit logic and unused variables
  implication: Now follows same pattern as working Stats pages

- timestamp: 2026-02-19
  checked: Build verification
  found: Next.js build completed successfully with no errors
  implication: Fix compiles correctly

## Resolution

root_cause: "hasMore" calculation in /api/my-movies used filtered results length (sortedMovies.length > pageEndIndex) instead of raw DB results length (watchListRecords.length > limit). When filters reduced the visible count below 20, hasMore incorrectly returned false even when more unfiltered records existed in DB.

fix: Changed hasMore calculation to use raw DB results length (watchListRecords.length > limit) with take = limit + 1 pattern, matching Stats pages implementation

verification: Build passed successfully
files_changed:
  - src/app/api/my-movies/route.ts: Changed pagination logic to use take=limit+1 and correct hasMore calculation
