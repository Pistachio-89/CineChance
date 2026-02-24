# Phase 10: Taste Map Infrastructure - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Create infrastructure for computing and storing Taste Map — user preference profiles built from watched movies. This enables similarity calculation between users for recommendation patterns. Phase 10 has 2 plans: (1) TasteMap data structure + Redis storage, (2) Similarity calculation.

</domain>

<decisions>
## Implementation Decisions

### Taste Map Data Structure
- **Genre Profile**: Record<string, number> — { "action": 85, "comedy": 70 }
- **Person Profiles**: actors and directors as Record<string, number>
- **Rating Distribution**: high (8-10), medium (5-7), low (1-4) percentages
- **Behavior Profile**: rewatchRate, dropRate, completionRate percentages
- **Computed Metrics**: positiveIntensity, negativeIntensity, consistency, diversity
- **Average rating** as single number

### Redis Storage Keys
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `user:{userId}:taste-map` | 24h | Full profile |
| `user:{userId}:genre-profile` | 24h | Genre-only |
| `user:{userId}:person-profile` | 24h | Persons-only |
| `user:{userId}:genre-bias` | 24h | Rating bias per genre |
| `user:{userId}:person-bias` | 24h | Rating bias per person |
| `user:{userId}:type-profile` | 24h | Content type profile |
| `similar-users:{userId}` | 24h | List of similar users |
| `similarity:{userId}:{otherUserId}` | 24h | Pair similarity score |

### Similarity Calculation
- **tasteSimilarity**: Cosine similarity of genre vectors
- **ratingCorrelation**: Rating correlation between users
- **personOverlap**: Overlap of favorite actors/directors
- **overallMatch**: Weighted sum of all metrics
- Threshold for "similar": tasteSimilarity > 0.7

### Update Mechanism
- Async background job on status/rating changes
- Cache results to avoid recalculation

### Claude's Discretion
- Exact data structure serialization format (JSON)
- Background job scheduling implementation
- Cache invalidation strategy
- Database vs Redis for computed profiles

</decisions>

<specifics>
## Specific Ideas

From docs/Pattern selection/00-Taste-Map.md:
- Taste Map built from watched movies only (not want-to-watch)
- Visualized as progress bars for genres, rating distribution chart
- Used for: find similar users, generate recommendations, predict drop risk

From docs/Pattern selection/0Y-Cache-Analysis.md:
- Redis TTL: 24h for all user profiles
- Global stats cached: genre associations, person associations, drop rates

</specifics>

<deferred>
## Deferred Ideas

None — all implementation details in documentation.

</deferred>

---

*Phase: 10-taste-map-infrastructure*
*Context gathered: 2026-02-22*
