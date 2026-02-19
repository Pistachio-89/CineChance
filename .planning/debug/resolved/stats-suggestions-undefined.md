---
status: investigating
trigger: "stats-suggestions-undefined - Runtime TypeError when accessing stats.suggestions.expandTypes"
created: 2026-02-19T00:00:00.000Z
updated: 2026-02-19T00:00:00.000Z
---

## Current Focus
hypothesis: "API error response doesn't include suggestions inside stats - it's at root level"
test: "Check API route for error response vs success response structure"
expecting: "Confirm error response is missing stats.suggestions"
next_action: "Fix API route to include suggestions in stats for error response"

## Symptoms
expected: Recommendations page should load with stats.suggestions containing expandTypes property
actual: "can't access property 'expandTypes', stats.suggestions is undefined" at RecommendationsClient.tsx:875
errors:
  - TypeError: can't access property "expandTypes", stats.suggestions is undefined
  - Occurs in FilterStateManager component
reproduction: Try to get recommendations after initial filter setup
timeline: Started after Phase 4 (adding cartoon filter) was deployed

## Eliminated

## Evidence
- timestamp: 2026-02-19
  checked: RecommendationsClient.tsx lines 875, 121-130
  found: Code checks `{stats.suggestions.expandTypes && ...}` but only guards with `{stats && ...}` - no guard for stats.suggestions
  implication: Either stats.suggestions is undefined OR stats itself is set without suggestions
- timestamp: 2026-02-19
  checked: API route random/route.ts success response (lines 918-927)
  found: Success response includes `stats: { ..., suggestions: { addMoreMovies, expandTypes, includeOtherLists } }`
  implication: Success case works correctly
- timestamp: 2026-02-19
  checked: API route random/route.ts error response (lines 704-715)
  found: Error response has `stats: { totalItems, afterTypeFilter, afterAdditionalFilters, isSmallLibrary }` but NO `suggestions` property inside stats
  implication: When no candidates found (error case), stats is set but without suggestions - causing the crash

## Resolution
root_cause: Error response in API route doesn't include suggestions inside stats - it's missing the suggestions property
fix: Added suggestions object to stats in error response at line 714-718 of random/route.ts, and added defensive checks in RecommendationsClient.tsx for stats.suggestions existence
verification: Lint check passed (existing console errors unrelated to changes)
files_changed:
  - src/app/api/recommendations/random/route.ts (added suggestions to error response stats)
  - src/app/recommendations/RecommendationsClient.tsx (added defensive checks for stats.suggestions)
