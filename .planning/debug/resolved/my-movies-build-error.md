---
status: resolved
trigger: "При попытке зайти на страницу Мои фильмы страница падает в ощибку - Build Error: await isn't allowed in non-async function"
created: 2026-02-23T20:31:30Z
updated: 2026-02-23T20:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "await trackOutcome() is called inside non-async function at line 617"
test: "Read the function containing line 617 to verify if it's async"
expecting: "Function is NOT async - will add async keyword"
next_action: "Archive session after successful build verification"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Страница Мои фильмы загружается корректно"
actual: "Build error - Parsing ecmascript source code failed"
errors: |
  await isn't allowed in non-async function
  ./src/app/api/my-movies/route.ts:617:11
  
  615 |         // Track outcome: user rated recommendation
  616 |         if (recommendationLogId) {
  617 |           await trackOutcome({
  618 |             recommendationLogId,
  619 |             action: 'rated',
  620 |             userRating: rating,
reproduction: "Перейти на страницу /my-movies"
started: "Страница падает с ошибкой Build Error"

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: "2026-02-23T20:32:00Z"
  checked: "src/app/api/my-movies/route.ts around line 617"
  found: "The code structure was malformed - if block with await trackOutcome() was incorrectly placed inside prisma.ratingHistory.create() call object"
  implication: "Invalid JavaScript syntax - cannot have if statement as part of object literal"

- timestamp: "2026-02-23T20:34:00Z"
  checked: "npm run build"
  found: "Build successful - /api/my-movies route compiles correctly"
  implication: "Fix verified - build passes"

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Malformed code structure - the if (recommendationLogId) block with await trackOutcome() was incorrectly placed inside the prisma.ratingHistory.create() call object (between data object and closing });), which is invalid JavaScript"
fix: "Moved the if block outside of create() call - now properly structured after the create() completes"
verification: "Build successful - next build completed with 64 routes in 1603ms"
files_changed:
  - "src/app/api/my-movies/route.ts"
