# Phase 10: Taste Map Infrastructure - Research

**Researched:** 2026-02-22
**Domain:** User preference profiling, similarity calculation, Redis caching
**Confidence:** HIGH

## Summary

This phase creates infrastructure for computing and storing Taste Map — user preference profiles built from watched movies. The implementation requires: (1) computing genre/person profiles from Prisma data + TMDB credits, (2) storing computed profiles in Redis with 24h TTL, (3) implementing cosine similarity and rating correlation for user matching.

**Primary recommendation:** Use existing Redis patterns from `src/lib/redis.ts` with `withCache` helper, implement cosine similarity as pure function (no external package needed), trigger taste-map computation via Next.js `after()` function for non-blocking background processing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Genre Profile**: Record<string, number> — { "action": 85, "comedy": 70 }
- **Person Profiles**: actors and directors as Record<string, number>
- **Rating Distribution**: high (8-10), medium (5-7), low (1-4) percentages
- **Behavior Profile**: rewatchRate, dropRate, completionRate percentages
- **Computed Metrics**: positiveIntensity, negativeIntensity, consistency, diversity
- **Average rating** as single number

### Redis Keys
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

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/redis | ^1.x | Redis operations | Already in project, HTTP-based for serverless |
| Prisma | 7.2 | Database queries | Already in project |
| TMDB API | v3 | Genre/person data | Already integrated via `src/lib/tmdb.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | Cosine similarity | Implement as pure function (no package needed) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in after() | Inngest/trigger.dev | Third-party adds complexity, not needed for simple async |
| No package | fast-cosine-similarity | External package adds dependency, formula is simple |

**Installation:**
```bash
# No new packages needed - using existing @upstash/redis already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── taste-map/           # NEW: Taste Map computation
│   │   ├── compute.ts       # Core computation functions
│   │   ├── similarity.ts    # Cosine similarity, correlation
│   │   ├── redis.ts         # Redis storage helpers (or extend existing)
│   │   └── types.ts         # TypeScript interfaces
│   └── redis.ts             # EXISTING: Extend if needed
```

### Pattern 1: Cache-Aside with TTL (RECOMMENDED)
**What:** Use existing `withCache` helper from `src/lib/redis.ts` with custom TTL
**When to use:** All taste-map data retrieval
**Example:**
```typescript
import { withCache } from '@/lib/redis';

const TTL_24H = 86400;

async function getTasteMap(userId: string): Promise<TasteMap> {
  return withCache<TasteMap>(
    `user:${userId}:taste-map`,
    () => computeTasteMap(userId),
    TTL_24H
  );
}
```

### Pattern 2: Cosine Similarity (PURE FUNCTION)
**What:** Standard mathematical formula implemented without external packages
**When to use:** Computing genre vector similarity
**Formula:** `cosineSimilarity(A, B) = (A · B) / (||A|| × ||B||)`
**Example:**
```typescript
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}
```

### Pattern 3: Genre Profile Computation
**What:** Aggregate ratings by genre from watched movies
**When to use:** Building the genre profile from Prisma data
**Example:**
```typescript
interface GenreAgg {
  genre: string;
  ratings: number[];
  watchCount: number;
}

function computeGenreProfile(watchedMovies: WatchListItem[]): Record<string, number> {
  const genreMap = new Map<string, GenreAgg>();
  
  for (const movie of watchedMovies) {
    const genres = movie.genres || [];
    for (const genre of genres) {
      const existing = genreMap.get(genre) || { genre, ratings: [], watchCount: 0 };
      existing.ratings.push(movie.userRating || movie.voteAverage);
      existing.watchCount++;
      genreMap.set(genre, existing);
    }
  }
  
  // Convert to normalized profile (0-100 scale)
  const profile: Record<string, number> = {};
  for (const [genre, agg] of genreMap) {
    const avgRating = agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length;
    profile[genre] = Math.round(avgRating * 10); // Scale to 0-100
  }
  
  return profile;
}
```

### Pattern 4: Person Profile Computation
**What:** Aggregate ratings by actor/director from TMDB credits
**When to use:** Building person preference profiles
**Example:**
```typescript
interface PersonAgg {
  personId: string;
  personName: string;
  ratings: number[];
  watchCount: number;
}

function computePersonProfile(
  watchedMovies: WatchListItemWithCredits[]
): { actors: Record<string, number>; directors: Record<string, number> } {
  const actorMap = new Map<string, PersonAgg>();
  const directorMap = new Map<string, PersonAgg>();
  
  for (const movie of watchedMovies) {
    const rating = movie.userRating ?? movie.voteAverage;
    
    for (const actor of movie.credits?.cast || []) {
      const existing = actorMap.get(actor.id) || { 
        personId: actor.id, 
        personName: actor.name, 
        ratings: [], 
        watchCount: 0 
      };
      existing.ratings.push(rating);
      existing.watchCount++;
      actorMap.set(actor.id, existing);
    }
    
    for (const crew of movie.credits?.crew || []) {
      if (crew.job === 'Director') {
        const existing = directorMap.get(crew.id) || { 
          personId: crew.id, 
          personName: crew.name, 
          ratings: [], 
          watchCount: 0 
        };
        existing.ratings.push(rating);
        existing.watchCount++;
        directorMap.set(crew.id, existing);
      }
    }
  }
  
  return {
    actors: normalizeProfile(actorMap),
    directors: normalizeProfile(directorMap)
  };
}

function normalizeProfile(map: Map<string, PersonAgg>): Record<string, number> {
  const profile: Record<string, number> = {};
  for (const [id, agg] of map) {
    const avgRating = agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length;
    profile[agg.personName] = Math.round(avgRating * 10);
  }
  return profile;
}
```

### Pattern 5: Background Update with Next.js `after()`
**What:** Use Next.js 14.2+ `after()` to trigger async computation without blocking response
**When to use:** When user changes status or rating
**Example:**
```typescript
import { after } from 'next/server';

export async function PATCH(req: Request) {
  // ... main logic (update status/rating)
  
  const userId = session.user.id;
  
  // Trigger async taste-map recomputation
  after(async () => {
    try {
      await recomputeTasteMap(userId);
    } catch (error) {
      logger.error('Taste map recompute failed', { 
        error: error instanceof Error ? error.message : String(error),
        userId 
      });
    }
  });
  
  return NextResponse.json({ success: true });
}
```

### Anti-Patterns to Avoid
- **Don't recompute synchronously**: Always use `after()` or queue for taste-map updates
- **Don't use external package for cosine similarity**: Formula is ~10 lines, adding dependency is overkill
- **Don't skip cache invalidation**: When ratings change, invalidate and recompute

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis TTL | Custom TTL implementation | Upstash `setex` or `set(..., { ex: 86400 })` | Already supported natively |
| JSON serialization | Custom parse/stringify | `JSON.stringify` (already in use) | Works fine |
| Cosine similarity | External library | Pure function (10 lines) | No dependency needed |

## Common Pitfalls

### Pitfall 1: Missing TMDB Credits Data
**What goes wrong:** Genre profile computed without person data because credits not fetched
**Why it happens:** `fetchMediaDetails` includes credits but parsed result doesn't extract them
**How to avoid:** Extend `MovieDetails` type to include credits, or call separate `/credits` endpoint
**Warning signs:** Person profiles empty despite watched movies

### Pitfall 2: Vector Length Mismatch in Cosine Similarity
**What goes wrong:** Similarity returns NaN or wrong values
**Why it happens:** Comparing vectors of different lengths (different genre sets)
**How to avoid:** Normalize both vectors to same genre set before comparison
**Example:**
```typescript
function normalizeForComparison(
  profileA: Record<string, number>,
  profileB: Record<string, number>
): [number[], number[]] {
  const allGenres = new Set([...Object.keys(profileA), ...Object.keys(profileB)]);
  const vecA = Array.from(allGenres).map(g => profileA[g] || 0);
  const vecB = Array.from(allGenres).map(g => profileB[g] || 0);
  return [vecA, vecB];
}
```

### Pitfall 3: Cache Stampede on TTL Expiry
**What goes wrong:** Multiple requests hit DB simultaneously when cache expires
**Why it happens:** All requests see expired cache at same time
**How to avoid:** Add small random jitter to TTL, or use locking (for this phase, random jitter is sufficient)
**Example:**
```typescript
const TTL_24H_WITH_JITTER = 86400 + Math.floor(Math.random() * 3600);
```

### Pitfall 4: Empty Profiles for New Users
**What goes wrong:** Division by zero or NaN when computing similarity for users with no watched movies
**Why it happens:** No data to compute profiles from
**How to avoid:** Check for minimum watch count (e.g., 5 movies) before computing similarity, return 0 for new users

## Code Examples

### Complete Taste Map Interface
```typescript
// From docs/Pattern selection/00-Taste-Map.md
export interface TasteMap {
  userId: string;
  
  // Genre profile (0-100 scale)
  genreProfile: Record<string, number>; // { "action": 85, "comedy": 70 }
  
  // Rating distribution (percentages)
  ratingDistribution: {
    high: number;   // 8-10
    medium: number; // 5-7
    low: number;    // 1-4
  };
  averageRating: number;
  
  // Person profiles
  personProfiles: {
    actors: Record<string, number>;   // { "ActorX": 75 }
    directors: Record<string, number>;
  };
  
  // Behavior profile
  behaviorProfile: {
    rewatchRate: number;      // % of watched that were rewatched
    dropRate: number;         // % of want that were dropped
    completionRate: number;  // % of started that were completed
  };
  
  // Computed metrics
  computedMetrics: {
    positiveIntensity: number;  // How much user rates highly
    negativeIntensity: number;  // How much user rates poorly
    consistency: number;       // Variance in ratings
    diversity: number;          // Genre variety
  };
  
  updatedAt: Date;
}
```

### Redis Storage Helper
```typescript
const TTL_24H = 86400;

export async function storeTasteMap(userId: string, tasteMap: TasteMap): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  await redis.set(`user:${userId}:taste-map`, tasteMap, { ex: TTL_24H });
}

export async function getTasteMap(userId: string): Promise<TasteMap | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  return redis.get(`user:${userId}:taste-map`);
}
```

### Similarity Score Calculation
```typescript
interface SimilarityResult {
  tasteSimilarity: number;     // Cosine similarity of genre vectors
  ratingCorrelation: number;   // Pearson correlation of ratings
  personOverlap: number;        // Jaccard similarity of favorite persons
  overallMatch: number;        // Weighted sum
}

function computeOverallMatch(result: SimilarityResult): number {
  // Weights from requirements
  const WEIGHTS = {
    tasteSimilarity: 0.5,
    ratingCorrelation: 0.3,
    personOverlap: 0.2
  };
  
  return (
    result.tasteSimilarity * WEIGHTS.tasteSimilarity +
    result.ratingCorrelation * WEIGHTS.ratingCorrelation +
    result.personOverlap * WEIGHTS.personOverlap
  );
}

function isSimilar(result: SimilarityResult): boolean {
  return result.tasteSimilarity > 0.7;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No caching | Redis with 24h TTL | Phase 10 | Eliminates redundant computation |
| On-demand compute | Background `after()` trigger | Phase 10 | Non-blocking updates |
| Single profile | Separate cached profiles (genre, person, type) | Phase 10 | More flexible queries |

**Deprecated/outdated:**
- None for this phase

## Open Questions

1. **Should similar-users list be computed on-demand or pre-computed?**
   - What we know: Both approaches work; on-demand is simpler but slower, pre-computed is faster but needs maintenance
   - What's unclear: How many similar users to store? What's the hit rate?
   - Recommendation: Start with on-demand via cache-aside, switch to pre-computed if needed

2. **How to handle TMDB API rate limits during bulk computation?**
   - What we know: TMDB has limits; batch fetching is needed
   - What's unclear: What's the optimal batch size?
   - Recommendation: Use existing pattern from `src/app/api/user/stats/route.ts` (10 parallel requests)

3. **Should computed metrics be stored in DB or only Redis?**
   - What we know: Redis 24h TTL matches requirements; DB provides persistence
   - What's unclear: Is persistence needed if TTL is short?
   - Recommendation: Redis only first; add DB if use cases require historical tracking

## Sources

### Primary (HIGH confidence)
- `/upstash/redis-js` - TTL, JSON storage patterns confirmed
- `src/lib/redis.ts` - Existing project patterns
- `src/lib/tmdb.ts` - Credits fetching (via `append_to_response: 'credits'`)
- Prisma schema - WatchList, RatingHistory, MovieStatus models

### Secondary (MEDIUM confidence)
- Context7 query on cosine similarity confirmed formula
- WebSearch on Next.js `after()` function confirmed availability in 14.2+

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries (@upstash/redis, Prisma)
- Architecture: HIGH - Based on existing patterns in project
- Pitfalls: HIGH - Known issues from pattern analysis

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days - stable domain)
