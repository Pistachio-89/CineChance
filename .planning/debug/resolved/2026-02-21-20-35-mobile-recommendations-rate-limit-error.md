---
status: resolved
trigger: "Recommendations page shows 'Too many requests' error on mobile (Android/Chrome) but works fine on desktop with same filters and 500+ movies. Error message is DIFFERENT from standard rate limit message."
created: 2026-02-21T20:00:00.000Z
updated: 2026-02-21T20:35:00.000Z
commit: cd59618
test_fix_commit: cd59619
---

## Current Focus
hypothesis: "Rate limiting applied BEFORE authentication, causing IP-based limiting. Mobile users on cellular networks share IPs, triggering shared limit."
test: "Move auth check before rate limiting in recommendations API, pass userId to rateLimit"
expecting: "Rate limit becomes per-user instead of per-IP, mobile users get individual limits"
next_action: "Commit fix and verify"

## Symptoms
expected: Recommendations should generate on mobile after clicking "Подобрать рекомендации" button
actual: "Too many requests Попробуйте изменить фильтры или добавить больше фильмов" appears on mobile only
errors: Different from standard rate limit message - this is custom error text
reproduction: Select filters on mobile -> click button -> error appears. Works on desktop.
started: Stopped working recently

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->
- timestamp: 2026-02-21
  checked: "Search for error text 'Попробуйте изменить фильтры'"
  found: "Found in RecommendationsClient.tsx line 889 - generic error message shown when viewState === 'error'"
  implication: "Error comes from API, not client-side"

- timestamp: 2026-02-21
  checked: "Rate limiting implementation in src/middleware/rateLimit.ts"
  found: "Line 74: rateLimit uses IP-based key (x-forwarded-for) when no userId provided"
  implication: "Mobile users on cellular networks share IPs, hitting shared limit"

- timestamp: 2026-02-21
  checked: "Recommendations API /api/recommendations/random/route.ts"
  found: "Line 274: rateLimit(req, '/api/recommendations') called BEFORE auth check (line 282)"
  implication: "No userId available, falls back to IP-based limiting"

- timestamp: 2026-02-21
  checked: "Historical debug session rate-limiting-architecture-failures.md"
  found: "Documented issue: IP-based limiting causes NAT issues for mobile/corporate networks"
  implication: "Known architectural issue - need to move auth before rate limiting"

## Resolution
root_cause: "Rate limiting applied BEFORE authentication check in recommendations API. Without userId, rate limiter falls back to IP-based limiting. Mobile users on cellular networks share public IPs via NAT, so multiple users appear as one IP and hit shared rate limit (30 req/min)."
fix: "Move authentication check BEFORE rate limiting, pass userId to rateLimit() call"
verification: "Tested on mobile - each user now gets individual rate limit"
files_changed:
  - "src/app/api/recommendations/random/route.ts"
  - "src/app/api/recommendations/[id]/action/route.ts"
  - "src/app/api/recommendations/preview/route.ts"
  - "src/app/api/recommendations/reset-logs/route.ts"

## Bonus Fix: fetchWithRetry Test
root_cause: "Test used vi.useFakeTimers() without shouldAdvanceTime: true, causing real delays to not advance in fake timer context"
fix: "Added { shouldAdvanceTime: true } to vi.useFakeTimers() call"
files_changed:
  - "src/lib/__tests__/fetchWithRetry.test.ts"
  - "vitest.config.ts"
