# AGENTS.md - Developer Guide for CineChance

> **IMPORTANT:** This file is read by AI agents. Always check this file first when working on the project.

This file provides guidelines and instructions for AI agents working on the CineChance project.

## Project Overview

**CineChance** is a movie tracker built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS. It features personalized recommendations, TMDB integration, and a rating system.

- **Database**: PostgreSQL (Neon) + Prisma 7.2
- **Auth**: NextAuth 4.24 with JWT strategy
- **External APIs**: TMDB, Upstash Redis (rate limiting)

---

## Build, Lint, and Test Commands

### Development
```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server
```

### Testing
```bash
npm run test:ci         # Run all tests (Vitest, CI mode)
npx vitest run          # Run all tests
npx vitest run <file>   # Run a single test file
npx vitest               # Run tests in watch mode
```

### Linting
```bash
npm run lint            # ESLint check
npm run lint:strict     # ESLint with max warnings 0
```

### Verification After Tasks

**MANDATORY after completing any code change:**
```bash
npm run lint            # ESLint check
npm run test:ci         # Run all tests (Vitest, CI mode)
```

Both commands must pass before considering the task complete.

### Database
```bash
npm run seed            # Seed database (ts-node prisma/seed.ts)
npx prisma generate     # Generate Prisma client (runs in postinstall)
npx prisma migrate dev --name <name>  # Create local migration
npx prisma db push      # Push schema without migration (dev only!)
```

---

## Code Style Guidelines

### General Principles
- **Server Components by default**: Use Server Components for data fetching; mark client components with `'use client'` at the top
- **No `any` types**: ESLint rules enforce `no-explicit-any` as error
- **No console.log**: Use the `logger` from `@/lib/logger` instead
- **Path aliases**: Always use `@/` for imports (e.g., `import { prisma } from '@/lib/prisma'`)

### TypeScript Conventions
```typescript
// Use explicit types for function parameters
async function fetchData(userId: string): Promise<DataType> { }

// Avoid any - use unknown or specific types
// BAD: const data: any = ...
// GOOD: const data: unknown = ... or specific interface

// Use proper error typing in catch blocks
} catch (error) {
  logger.error('Message', { 
    error: error instanceof Error ? error.message : String(error),
    context: 'ComponentName'
  });
}
```

### Import Order (recommended)
1. External libraries (React, Next.js)
2. Internal imports (`@/lib/`, `@/hooks/`)
3. Relative imports (`./`, `../`)
4. Type imports (`import type`)

```typescript
import { useState, useEffect } from 'react';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { SomeType } from '@/lib/types';
```

### Naming Conventions
- **Files**: kebab-case for utilities (`calculateWeightedRating.ts`), PascalCase for components (`MovieCard.tsx`)
- **Functions**: camelCase (`calculateWeightedRating`)
- **Types/Interfaces**: PascalCase (`interface MovieData`)
- **Constants**: UPPER_SNAKE_CASE for config constants, camelCase for mapping objects
- **React Components**: PascalCase (`export default function MovieCard()`)

### Component Structure
```typescript
// Client Component
'use client';

import { useState } from 'react';

interface Props {
  movie: Movie;
  onSelect: (id: number) => void;
}

export default function MovieCard({ movie, onSelect }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Server Components with Suspense
```typescript
import { Suspense } from 'react';
import LoaderSkeleton from '@/app/components/LoaderSkeleton';

async function DataLoader({ userId }: { userId: string }) {
  const data = await fetchData(userId);
  return <Display data={data} />;
}

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <div>Unauthorized</div>;

  return (
    <Suspense fallback={<LoaderSkeleton variant="full" text="Loading..." />}>
      <DataLoader userId={session.user.id} />
    </Suspense>
  );
}
```

---

## Error Handling

### API Routes
```typescript
export async function GET(req: Request) {
  const { success } = await rateLimit(req, '/api/endpoint');
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Logic here
    
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Endpoint GET error', { 
      error: error instanceof Error ? error.message : String(error),
      context: 'EndpointName'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### Prisma Errors
- Always use the singleton: `import { prisma } from '@/lib/prisma'`
- Never create new `PrismaClient()` instances
- Handle not-found cases explicitly with `null` checks

---

## Key Libraries and Patterns

### Authentication
- Use `getServerSession(authOptions)` in Server Components and Route Handlers
- Import `authOptions` from `@/auth`
- User ID: `session.user.id`

### Rate Limiting
```typescript
import { rateLimit } from '@/middleware/rateLimit';

const { success } = await rateLimit(request, '/api/path');
if (!success) {
  return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
}
```

### Prisma Queries
```typescript
// Find unique with composite key
const record = await prisma.watchList.findUnique({
  where: {
    userId_tmdbId_mediaType: { userId, tmdbId, mediaType },
  },
});

// Upsert pattern
await prisma.watchList.upsert({
  where: { /* composite key */ },
  update: { /* fields to update */ },
  create: { /* fields for new record */ },
});
```

### TMDB Integration
- All TMDB calls are in `src/lib/tmdb.ts`
- Uses ISR caching (1 hour for trending/popular)
- Handle missing `TMDB_API_KEY` gracefully

---

## File Organization

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/              # API Route Handlers
│   ├── components/       # Shared UI components
│   └── [feature]/        # Feature-specific pages
├── lib/                   # Utility functions and singletons
├── hooks/                 # Custom React hooks
├── middleware/            # Next.js middleware (rate limiting)
└── auth.ts               # NextAuth configuration
```

---

## Important Configuration

### Environment Variables Required
```bash
DATABASE_URL=postgresql://...   # Neon PostgreSQL
NEXTAUTH_SECRET=<32-char>        # JWT signing key
NEXTAUTH_URL=http://localhost:3000
TMDB_API_KEY=...                 # TMDB v3 API
UPSTASH_REDIS_REST_URL=...       # Rate limiting
UPSTASH_REDIS_REST_TOKEN=...
NODE_ENV=development|production
```

### Database Models (Prisma Schema)
Key models in `prisma/schema.prisma`:
- `User` - User accounts with password hash
- `WatchList` - Movie/show entries with composite key `userId_tmdbId_mediaType`
- `RatingHistory` - Rating change history
- `RecommendationLog` - Recommendation interaction tracking
- `MovieStatus` - Status definitions (want, watched, dropped, rewatched)

---

## Additional Resources

- See `.github/copilot-instructions.md` for detailed architecture and workflow guidance
- Check `docs/` folder for project-specific documentation
- Use `context7` tool to verify external library documentation when needed

---

## Error Handling and Bug Fixing Protocol

### GSD Debug System (Primary Method)

**When user reports a bug, use `/gsd-debug` command:**

```bash
/gsd-debug "Description of the problem"
```

**What GSD Debug does:**
1. Creates persistent debug session in `.planning/debug/`
2. Autonomously investigates root cause using systematic method
3. Can either diagnose only OR find + fix + verify
4. Archives resolved sessions to `.planning/debug/resolved/`
5. Survives context resets - can resume with `/gsd-debug`

**Modes:**
- **Interactive** (default): Asks questions, investigates, fixes
- **Diagnose only**: Returns root cause for complex cases
- **Find and fix**: Complete cycle including verification

### Pre-Debug Research (MANDATORY)

**Before using `/gsd-debug` or writing ANY code:**

**Order: L2 → L3 → L1 (for bugs)**

1. **Search Local Knowledge Base (L2) - FIRST!**
   ```bash
   # Check for similar issues
   cat .planning/debug/resolved/*.md | grep -i "error-message"
   cat docs/bugs/README.md | grep -i "symptom"
   ```
   - **CRITICAL**: 17 past incidents analyzed in `.planning/debug/resolved/`
   - Check SYSTEMIC_REFLECTION.md for patterns
   - Check specific group files (pagination, rate-limiting, etc.)
   - **Why first?** Contains real-world problems not in official docs

2. **Verify with Context7 (L3) - SECOND**
   - Use for external library APIs (React, Next.js, Prisma)
   - Verify best practices and recent changes
   - Check official documentation
   - **Purpose**: Validate syntax, confirm patterns, find official solutions

3. **Check Current Context (L1) - THIRD**
   - Review relevant source files
   - Check imports and dependencies
   - Understand current implementation
   - **Purpose**: Apply solutions to specific code context

### Context Priority Order (MANDATORY)

**For Bug Investigation:**
1. **L2 - Local knowledge base**: `.planning/debug/resolved/`, `docs/bugs/`, `docs/`
2. **L3 - External expertise**: Context7 for libraries and frameworks  
3. **L1 - Local context**: Current file, imports, call stack

**For New Features:**
1. **L3 - External expertise**: Context7 for library APIs and patterns
2. **L1 - Local context**: Current codebase conventions
3. **L2 - Local knowledge base**: Similar implementations

**Rule**: If local docs contradict context7, **local takes priority** - our project is the source of truth.

### When to Use `/gsd-debug` vs Manual Investigation

**Use `/gsd-debug` when:**
- User reports symptoms but cause is unknown
- Multiple files potentially involved
- Need to verify fix across environments
- Want structured investigation trail

**Manual investigation OK when:**
- Simple typo or obvious syntax error
- Single file change needed
- Already identified root cause

### Legacy Bug Documentation

**Historical incidents migrated to:**
```
.planning/debug/resolved/
├── SYSTEMIC_REFLECTION.md              # Systemic analysis
├── pagination-system-failures.md       # 3 incidents
├── rate-limiting-architecture-failures.md  # 4 incidents
├── status-display-consistency-failures.md  # 3 incidents
├── caching-architecture-failures.md    # 4 incidents
└── api-architecture-failures.md        # 3 incidents
```

**Always check these before debugging new issues.**

### Context7 Usage Guidelines

> **IMPORTANT:** Context7 MCP is configured and available in this project. You MUST use `context7_query-docs` tool for all external library questions. Do NOT rely on internal knowledge for library APIs.

**Context7 is REQUIRED for:**
- ✅ New library APIs (first-time usage)
- ✅ Version-specific features (Next.js 16 vs 15 differences)
- ✅ Official best practices and patterns
- ✅ Configuration options and parameters
- ✅ Syntax validation and type signatures

**Context7 is SECONDARY to Local Knowledge (L2) for:**
- ❌ Known project patterns (pagination, rate limiting, caching)
- ❌ Historical bugs and their solutions
- ❌ Project-specific edge cases (Prisma sorting instability)
- ❌ Systemic architectural issues

**Why Local Knowledge (L2) Takes Priority:**

After testing Context7 on Next.js and Prisma, we confirmed:

1. **Official docs don't document real-world problems**
   - Context7: "Use `skip` and `take` for pagination"
   - Local: "Must add `{ id: 'desc' }` secondary sort or pagination breaks"
   - Source: `pagination-system-failures.md`

2. **Context7 doesn't cover combinatorial issues**
   - Context7: "Use rate limiting for security"
   - Local: "Rate limit AFTER auth and cache check, not before"
   - Source: `rate-limiting-architecture-failures.md`

3. **Project-specific solutions are unique**
   - Context7: Standard image loading patterns
   - Local: Our `image-proxy` solution for mobile CORS + Redis caching
   - Source: `caching-architecture-failures.md`

**Correct Workflow:**
```bash
# 1. Always start with L2 (Local Knowledge Base)
grep -r "pagination" .planning/debug/resolved/
# → Found: secondary sort required, hasMore calculation pattern

# 2. Use Context7 to VALIDATE and REFINE
curl -X POST context7/query \
  -d '{"libraryId": "/prisma/docs", "query": "orderBy multiple fields"}'
# → Confirms: syntax is correct
# → Does NOT mention: unstable sorting on non-unique fields

# 3. Apply local solution with confidence
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]  # Local knowledge wins
```

### When to Use Context7 vs Local Docs

| Scenario | Primary Source | Secondary Source |
|----------|---------------|------------------|
| Pagination bugs | **L2** - `.planning/debug/resolved/pagination-system-failures.md` | Context7 - syntax validation |
| Rate limiting issues | **L2** - `.planning/debug/resolved/rate-limiting-architecture-failures.md` | Context7 - default configs |
| Redis caching problems | **L2** - `.planning/debug/resolved/caching-architecture-failures.md` | Context7 - Redis commands |
| Server Actions errors | **L2** - `.planning/debug/resolved/api-architecture-failures.md` | Context7 - valid patterns |
| Status display bugs | **L2** - `.planning/debug/resolved/status-display-consistency-failures.md` | Context7 - React patterns |
| New library feature | **Context7** - official docs | L2 - similar implementations |
| Unknown error message | **Context7** - search error in docs | L2 - grep for similar |
| API syntax question | **Context7** - official reference | L1 - check current code |

### Context7 - MANDATORY Cases

**You MUST use context7 automatically in these cases:**
- When writing code that uses external libraries (React, Next.js, Prisma, etc.)
- When unsure about API methods or parameters
- When setting up configuration
- When the user asks about library usage
- When encountering error messages you don't recognize
- When implementing features you've never done before

**DO NOT rely on your internal knowledge** - always use context7 to get current, accurate information.

### Documentation Best Practices

**For GSD-resolved issues:**
- Session automatically archived in `.planning/debug/resolved/`
- No manual documentation needed
- Reference in future: grep the resolved directory

**For manual fixes:**
1. Check if similar pattern exists in resolved/
2. Update relevant group file if pattern-related
3. Update SYSTEMIC_REFLECTION.md if systemic issue found

### Documentation Cleanup Policy
- **Don't create files for one-off tests**: Use existing files
- **Don't duplicate**: Add to existing group files
- **Remove outdated docs**: After migrating to GSD format

### Important Notes
- Synthesize context7 findings: "According to official docs [Link], method X changed, so we update line Y"
- Local project docs always take priority over external documentation
- Check `.planning/debug/resolved/SYSTEMIC_REFLECTION.md` for architectural patterns

---

## Alternative: Manual Debug Workflow (For Non-GSD Agents)

**For agents that cannot use `/gsd-debug` command** (general, explore, or other OpenCode agents):

### Quick Investigation Steps

1. **Gather Symptoms**
   - Ask user: "What did you expect to happen?" and "What actually happened?"
   - Note any error messages
   - Ask when it started (recent or always broken)

2. **Search Local Knowledge (L2)**
   ```bash
   grep -r "keyword" .planning/debug/resolved/
   cat .planning/debug/resolved/pagination-system-failures.md
   ```
   - Check for similar past issues in `.planning/debug/resolved/`
   - Look at SYSTEMIC_REFLECTION.md for patterns

3. **Investigate Code (L1)**
   - Find relevant files: `glob "**/*module*.ts"` 
   - Read the implementation
   - Add logging if needed: `console.log('[DEBUG]', variable)`

4. **Form Hypothesis & Fix**
   - Make one change at a time
   - Test after each change
   - Verify the fix works

5. **Document the Fix**
   - Create a simple markdown file in `.planning/debug/resolved/`
   - Include: issue, root cause, fix, files changed

### When to Use This Approach

**Manual investigation OK when:**
- Simple typo or obvious syntax error
- Single file change needed
- You already know the root cause
- You cannot use `/gsd-debug` command

**Request GSD help when:**
- Complex multi-file investigation needed
- Root cause is unclear
- Need persistent investigation session
