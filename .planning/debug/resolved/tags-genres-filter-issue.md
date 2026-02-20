---
status: resolved
trigger: "на странице profile/stats не корректно отрабатывают блоки Теги и Жанры при переключении фильтров по типам контента. Данные не меняются"
created: 2026-02-20T00:00:00Z
updated: 2026-02-20T00:00:04Z
---

## Current Focus

hypothesis: Fix implemented - testing verification
test: Run lint and tests
expecting: All checks pass
next_action: Verify fix with npm run lint and npm run test:ci

## Symptoms

expected: Tags and Genres sections should filter to show only tags/genres from the selected content type (movie, tv, cartoon, anime) when clicking content type cards
actual: Tags and Genres data doesn't change when switching filters - stays showing all data
errors: None reported
reproduction: Go to /profile/stats, click on content type card (Фильмы/Сериалы/Мультфильмы/Аниме), observe Tags and Genres sections remain unchanged
started: Likely related to recent 06-03 fix that added API filtering for cartoon/anime - averageRating and ratingDistribution were fixed but Tags/Genres may have been missed

## Eliminated

(none - first hypothesis confirmed)

## Evidence

- timestamp: 2026-02-20T00:00:00Z
  checked: User symptoms
  found: Tags/Genres don't update when content type filter changes, but other sections (averageRating, ratingDistribution) do work
  implication: Filtering mechanism exists for some data but not applied to Tags/Genres

- timestamp: 2026-02-20T00:00:01Z
  checked: StatsClient.tsx lines 179-187
  found: `statsUrl` correctly passes `?media=${typeFilter}`, but `/api/user/tag-usage` and `/api/user/genres` are called WITHOUT any filter parameter
  implication: Frontend is not passing the filter to these endpoints

- timestamp: 2026-02-20T00:00:02Z
  checked: /api/user/tag-usage/route.ts and /api/user/genres/route.ts
  found: Neither API route accepts or processes a `media` parameter for content type filtering
  implication: Backend doesn't support filtering even if frontend passed the param

## Resolution

root_cause: Two-part issue: (1) StatsClient.tsx doesn't pass `typeFilter` to tag-usage and genres API calls, (2) those API routes don't support media type filtering - they need the same cartoon/anime classification logic that stats route has
fix: 
  1. StatsClient.tsx: Added `media` query param to tag-usage and genres API calls when typeFilter is set
  2. tag-usage/route.ts: Added media filtering support with isAnime/isCartoon classification for cartoon/anime types
  3. genres/route.ts: Added media filtering support with isAnime/isCartoon classification for cartoon/anime types
verification: Lint passes (pre-existing console errors in other files), tests pass (pre-existing timeout in fetchWithRetry test)
files_changed:
  - src/app/profile/stats/StatsClient.tsx
  - src/app/api/user/tag-usage/route.ts
  - src/app/api/user/genres/route.ts
