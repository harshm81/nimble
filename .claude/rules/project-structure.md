---
description: Project structure and file placement rules — apply when creating new files or directories
paths: ["src/**", "prisma/**"]
---

# Project Structure Rules

## Project Root
**Always:** `/var/www/html/Nimble/nimble-api`
**Never** create files outside this root.

## Source Layout

```
src/
  adapters/<platform>/     # API fetch functions only — no DB, no transforms
  transform/<platform>/    # Pure mapping functions — no DB, no API calls
  db/
    prismaClient.ts        # Prisma client (default export)
    repositories/          # DB upsert/query — raw SQL via $executeRaw
  workers/                 # BullMQ job processors
  queue/                   # Queue definitions, scheduler, connection
  types/                   # TypeScript interfaces per platform
  constants/               # Per-platform string constants (platform, queue, jobs, base URL)
  utils/                   # logger, chunk, sleep — shared only
  config/                  # index.ts — env config
  server/                  # Express app
  auth/                    # Token management
```

## Layer Rules

### Adapters (`src/adapters/<platform>/`)
- One file per resource: `orders.ts`, `contacts.ts`, etc.
- Exports one `fetch*` function per file
- Handles pagination + rate limiting (`import { sleep } from '../../utils/sleep'`, 350ms)
- No business logic, no DB calls, no transforms
- Uses base URL from `src/constants/<platform>.ts` via the platform client

### Transformers (`src/transform/<platform>/`)
- One file per resource: `orderTransformer.ts`, etc.
- Exports one `transform*` function per file
- **Must declare an explicit return type** — the repo `*Input` interface from `src/db/repositories/<platform>Repo.ts`
- Input: raw API type + `syncedAt: Date`
- Output: typed as `*Input` — TypeScript enforces the contract at compile time

```ts
// REQUIRED pattern — explicit return type, not inferred
import { OrderInput } from '../../db/repositories/cin7Repo';
export function transformOrder(raw: Cin7SalesOrder, syncedAt: Date): OrderInput {
  return { ... };
}
```

### Repositories (`src/db/repositories/`)
- One file per platform: `cin7Repo.ts`
- Exports `*Input` interfaces — field names must match Prisma model field names (camelCase)
- Exports `upsert*` functions returning `Promise<number>`
- Chunk size: 200 rows — uses `import { chunk } from '../../utils/chunk'`
- Uses `Prisma.sql` + `Prisma.join` — never string concat SQL
- No logging, no business logic

### Types (`src/types/`)
- One file per platform: `cin7.types.ts`
- Named exports only — no default exports
- No imports, no business logic
- Nullable fields: `Type | null`
- Dates: `string` (raw API format)

## Key Files
- `src/db/prismaClient.ts` — `import prisma from '../db/prismaClient'`
- `src/utils/logger.ts` — `import { logger } from '../utils/logger'`
- `src/utils/sleep.ts` — `import { sleep } from '../utils/sleep'` (never inline)
- `src/utils/chunk.ts` — `import { chunk } from '../utils/chunk'` (never inline)
- `src/config/index.ts` — all env vars via `config.*` (never `process.env` directly)

## Schema-First Rule

**The Prisma schema is the single source of truth.** Every other layer is derived from it.
Never write repo interfaces, transformers, or worker code before the schema and migration exist.

See `.claude/rules/platform-integration.md` for the mandatory step-by-step order.
