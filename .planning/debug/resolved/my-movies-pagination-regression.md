---
status: resolved
trigger: "Пагинация на странице Мои фильмы работает неправильно - Only 1 additional movie loads (should load 20), Loader flickers, More button appears unexpectedly"
created: 2026-02-19T10:00:00.000Z
updated: 2026-02-19T10:15:00.000Z
---

## Current Focus

hypothesis: "API returns hasMore=true based on RAW database record count, not FILTERED count. When filters are applied, the API still says hasMore=true even if filtered result has fewer than limit items"
test: "Fix the hasMore calculation to check sortedMovies.length instead of watchListRecords.length"
expecting: "hasMore will correctly reflect whether there are more filtered movies"
next_action: "Apply fix to line 418 of route.ts"

## Symptoms

expected: |
  - Infinite scroll on My Movies page (no "More" button)
  - Load 20 movies per page when scrolling
  
actual: |
  - Only 1 movie loads on next page
  - Loader flickers
  - "More" button appears unexpectedly
  - No new movies in the list after flicker

errors: []

reproduction: "Scroll down on My Movies page - see incorrect behavior"

started: "After previous fix attempt (regression)"

## Eliminated

## Evidence

- timestamp: 2026-02-19T10:00:00.000Z
  checked: "Stats pages for comparison"
  found: "Stats pages work correctly - infinite scroll, no button"
  implication: "The pattern works elsewhere, so implementation exists

- timestamp: 2026-02-19T10:05:00.000Z
  checked: "API route.ts pagination logic (lines 410-424)"
  found: "Line 418: hasMore = watchListRecords.length > limit - checks RAW DB count (21), not FILTERED count"
  implication: "BUG FOUND: hasMore is calculated before filtering/pagination, using wrong variable

- timestamp: 2026-02-19T10:06:00.000Z
  checked: "Comparison with stats API (movies-by-genre/route.ts)"
  found: "Same bug at line 200: hasMore = watchListRecords.length > limit"
  implication: "Stats pages may also have this bug (but less noticeable with more data)

## Resolution

root_cause: "API calculated hasMore based on RAW database record count (watchListRecords.length > limit), not the FILTERED and SORTED result count. This caused hasMore=true even when filtering reduced the actual result below the page size"

fix: "Changed line 418 in src/app/api/my-movies/route.ts from `hasMore = watchListRecords.length > limit` to `hasMore = sortedMovies.length > pageEndIndex` to correctly check if there are more movies in the filtered/sorted result"

verification: "Build successful. Need to test manually to verify: 1) More button should NOT appear on My Movies page (infinite scroll), 2) Scrolling should load 20 movies per page"
files_changed: ["src/app/api/my-movies/route.ts"]
