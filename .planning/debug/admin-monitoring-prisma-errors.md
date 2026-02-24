---
status: investigating
trigger: "на странице /admin/monitoring в консоли идут сообщения об ошибках - Prisma query errors"
created: 2026-02-23T21:32:21Z
updated: 2026-02-23T21:32:21Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Two bugs in recommendation-outcome-tracking.ts: 1) userId is null/undefined in getOutcomeStats calls, 2) using parent instead of parentLog in calculateAcceptanceRate"
test: "Read src/lib/recommendation-outcome-tracking.ts and check getOutcomeStats and calculateAcceptanceRate functions"
expecting: "Functions have incorrect Prisma query filters"
next_action: "Read the file and identify the exact bugs"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Страница /admin/monitoring загружается без ошибок"
actual: "В консоли ошибки Prisma: Argument userId must not be null, Unknown argument parent"
errors: |
  1. Argument `userId` must not be null - getOutcomeStats called with undefined userId
  2. Unknown argument `parent` - should be `parentLog` in calculateAcceptanceRate
reproduction: "Открыть страницу /admin/monitoring"
started: "После последних изменений в ML feedback loop"

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->


## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 
fix: 
verification: 
files_changed: []
