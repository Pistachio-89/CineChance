# Phase 18: Карта вкуса (Taste Map) - Research

**Researched:** 2026-02-24
**Domain:** Next.js UI components, Redis caching, User preference visualization
**Confidence:** HIGH

## Summary

Phase 18 implements the user-facing Taste Map feature. From Phase 10, we already have complete backend infrastructure: TasteMap types, compute functions, Redis storage with 24h TTL, and similarity calculations. This phase adds:

1. **Profile Card** - A clickable card on `/profile` linking to detailed taste map
2. **Taste Map Page** - New page displaying all taste map data with visualizations
3. **API Endpoint** - `GET /api/user/taste-map` to serve cached taste map data

**Primary recommendation:** Create server-side data fetching in the new page, use existing Redis cache, build reusable visualization components following existing project patterns.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 16 | App Router | Page routing, Server Components | Project default |
| React 19 | - | UI components | Project default |
| Tailwind CSS | - | Styling | Project default |
| Lucide React | - | Icons | Already used in profile |
| Recharts | ^2.x | Data visualization (charts) | Standard React charting library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/taste-map/* | - | Existing backend infrastructure | All taste map operations |
| @/lib/redis | withCache | Redis caching | API route data fetching |
| rateLimit | - | Rate limiting | API protection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js / pure CSS | Recharts is more React-idiomatic, tree-shakeable |
| New endpoint | Reuse /api/user/stats | Separate endpoint keeps concerns clean, different caching strategy |

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── profile/
│   │   ├── taste-map/
│   │   │   ├── page.tsx           # Server Component - page layout
│   │   │   └── TasteMapClient.tsx # Client Component - visualizations
│   │   └── components/
│   │       └── TasteMapCard.tsx  # Profile page card component
│   └── api/
│       └── user/
│           └── taste-map/
│               └── route.ts       # API endpoint for taste map data
```

### Pattern 1: Profile Card Integration
**What:** Add clickable card to ProfileOverviewClient following existing link patterns
**When to use:** Navigation from profile to detailed taste map
**Example:**
```typescript
// Based on existing ProfileOverviewClient patterns
<Link
  href="/profile/taste-map"
  className="flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg md:rounded-xl p-4 md:p-5 border border-purple-500/30 hover:border-purple-400/50 transition cursor-pointer"
>
  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-400/20 rounded-full flex items-center justify-center flex-shrink-0">
    <MapIcon className="w-5 h-5 text-purple-400" />
  </div>
  <div className="flex-1">
    <p className="text-white font-medium text-sm md:text-base">Карта вкуса</p>
    <p className="text-gray-500 text-xs md:text-sm">Ваши предпочтения в фильмах</p>
  </div>
  <ArrowRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
</Link>
```

### Pattern 2: API Route with Caching
**What:** Use existing `withCache` pattern from @/lib/redis
**When to use:** Fetching taste map data with Redis caching
**Example:**
```typescript
// Based on /api/user/stats/route.ts pattern
import { getTasteMap } from '@/lib/taste-map/redis';

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(request, '/api/user/taste-map');
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasteMap = await getTasteMap(session.user.id);
  return NextResponse.json(tasteMap || { empty: true });
}
```

### Pattern 3: Server Component with Client Visualizations
**What:** Page fetches data server-side, passes to client component for interactive display
**When to use:** Any page with visualizations or user interaction
**Example:**
```typescript
// page.tsx - Server Component
import TasteMapClient from './TasteMapClient';
import { getTasteMap } from '@/lib/taste-map/redis';

export default async function TasteMapPage() {
  const session = await getServerSession(authOptions);
  const tasteMap = await getTasteMap(session.user.id);
  
  return <TasteMapClient tasteMap={tasteMap} />;
}

// TasteMapClient.tsx - Client Component with charts
'use client';
import { BarChart, PieChart } from 'recharts';
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching | Custom fetch logic | `getTasteMap()` from redis.ts | Already handles cache-aside pattern |
| Caching | Manual Redis operations | `withCache` from @/lib/redis | Consistent TTL, error handling |
| Charts | Raw Canvas/SVG | Recharts | React-native, accessible, well-maintained |
| Type definitions | Custom interfaces | Import from @/lib/taste-map/types.ts | Already complete |

**Key insight:** Phase 10 already built complete backend. This phase only adds UI layer.

---

## Common Pitfalls

### Pitfall 1: Missing TasteMap Data for New Users
**What goes wrong:** New users with no watched movies get empty taste map, page looks broken
**Why it happens:** computeTasteMap returns empty profile for users with < 1 watched item
**How to avoid:** Handle empty state in UI with call-to-action to add movies
**Warning signs:** Empty genreProfile, all zeros in computedMetrics

### Pitfall 2: Stale Cache
**What goes wrong:** User's taste map doesn't update after adding new ratings
**Why it happens:** Redis cache has 24h TTL, computed on first access
**How to avoid:** Call `invalidateTasteMap(userId)` from redis.ts when user adds/updates rating
**Warning signs:** Taste map doesn't reflect recent changes

### Pitfall 3: Heavy TMDB API Calls During Compute
**What goes wrong:** Taste map computation is slow, times out
**Why it happens:** computeTasteMap fetches TMDB details for up to 50 items
**How to avoid:** Already limited to 50 items in compute.ts, rely on cached data
**Warning signs:** API calls in page load, slow initial render

---

## Code Examples

### Displaying Genre Profile (Bar Chart)
```typescript
// Source: Recharts official docs + project patterns
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const genreData = Object.entries(tasteMap.genreProfile)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 10); // Top 10 genres

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={genreData} layout="vertical">
    <XAxis type="number" domain={[0, 100]} />
    <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#9ca3af', fontSize: 12 }} />
    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
  </BarChart>
</ResponsiveContainer>
```

### Displaying Rating Distribution (Pie Chart)
```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const ratingData = [
  { name: 'Высокие (8-10)', value: tasteMap.ratingDistribution.high, color: '#22c55e' },
  { name: 'Средние (5-7)', value: tasteMap.ratingDistribution.medium, color: '#eab308' },
  { name: 'Низкие (1-4)', value: tasteMap.ratingDistribution.low, color: '#ef4444' },
];

<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie
      data={ratingData}
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={80}
      dataKey="value"
      label={({ name, value }) => `${name}: ${value}%`}
    >
      {ratingData.map((entry, index) => (
        <Cell key={entry.name} fill={entry.color} />
      ))}
    </Pie>
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

### Top Persons Display
```typescript
// Display top actors and directors as chips/tags
const topActors = Object.entries(tasteMap.personProfiles.actors)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

<div className="flex flex-wrap gap-2">
  {topActors.map(([name, score]) => (
    <span 
      key={name}
      className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm"
    >
      {name} ({score}%)
    </span>
  ))}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No taste map | Backend computed from watch list | Phase 10 | ✅ Implemented |
| No UI | Profile card + detailed page | Phase 18 (this) | 📋 Planned |
| Hardcoded charts | Recharts components | Phase 18 | 📋 Planned |

**Deprecated/outdated:**
- None - this is a new feature layer on existing infrastructure

---

## Open Questions

1. **Should taste map auto-recompute on rating changes?**
   - What we know: `invalidateTasteMap()` exists in redis.ts but may not be called on rating updates
   - What's unclear: Performance impact of immediate recompute
   - Recommendation: Keep 24h cache for v1, add manual "Refresh" button

2. **How to handle very large genre profiles?**
   - What we know: Currently no limit, but computeTasteMap limits to 50 items
   - What's unclear: UI display for 50+ genres
   - Recommendation: Display top 10-15 genres, "Show more" expandable section

3. **Should we show similarity to other users on this page?**
   - What we know: Similarity data available in similarity.ts
   - What's unclear: Privacy implications, performance
   - Recommendation: Defer to future phase (Taste Match patterns)

---

## Sources

### Primary (HIGH confidence)
- `/src/lib/taste-map/types.ts` - Complete TasteMap interface
- `/src/lib/taste-map/compute.ts` - Computation logic, 50-item limit
- `/src/lib/taste-map/redis.ts` - Caching with 24h TTL
- `/src/lib/taste-map/similarity.ts` - Similarity calculations
- `/src/app/profile/components/ProfileOverviewClient.tsx` - UI patterns
- `/src/app/api/user/stats/route.ts` - API route patterns with caching

### Secondary (MEDIUM confidence)
- Recharts documentation - Chart components
- Context7: Next.js 16 App Router - Server/Client component patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project patterns and libraries
- Architecture: HIGH - Following established patterns from stats/profile pages
- Pitfalls: HIGH - Known from compute.ts limitations and caching strategy

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days - stable feature)
