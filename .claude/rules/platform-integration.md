# Platform Integration Rules

## The Problem This Prevents

Schema, repo interfaces, and transformers written independently drift apart silently.
The result is INSERT statements referencing columns that don't exist, discovered only at runtime.
The fix is a strict build order where each layer is derived from the one before it.

## Mandatory Step Order

Complete each step fully before starting the next. Never skip or reorder.

```
Step 1 — Constants
Step 2 — API Types
Step 3 — Schema + Migration   ← VERIFY in DB before continuing
Step 4 — Repo Interfaces
Step 5 — Transformers
Step 6 — Adapters + API Client
Step 7 — Repository upsert functions
Step 8 — Worker
Step 9 — Scheduler + index.ts
```

---

### Step 1 — Constants `src/constants/<platform>.ts`

Create the constants file first. Everything else imports from it.

```ts
export const PLATFORM    = '<platform>';
export const QUEUE       = '<platform>';
export const BASE_URL    = 'https://...';
export const JOBS = {
  RESOURCE_ONE: '<platform>:resource-one',
  RESOURCE_TWO: '<platform>:resource-two',
} as const;
```

---

### Step 2 — API Types `src/types/<platform>.types.ts`

Mirror the raw API response shape exactly.
- All dates as `string`
- **Every field is `Type | null` by default** — only remove `| null` when API docs explicitly guarantee the field is always present
- Nested object fields (`{ shopMoney: { amount: string } }`) are also `| null` by default
- No imports, no logic

**Why nullable by default:** The API contract is broader than what you observe in test data. Fields that look non-null in dev data are often null for edge-case records (draft orders, partial refunds, etc.) — a `parseFloat(null.amount)` crash will not appear until production.

---

### Step 3 — Schema + Migration `prisma/schema.prisma`

Add the Prisma model. Then **immediately run the migration and verify the table in the DB** before writing any other code.

```bash
npx prisma migrate dev --name add_<platform>_<resource>
```

**Do not proceed to Step 4 until the migration has run and the table exists.**
This is the gate that prevents all column-name drift.

Field naming rules:
- Prisma field: `camelCase`
- DB column: `snake_case` via `@map`
- Every field must have `@map`
- Every model must have `@@map`
- Required columns on every table: see `prisma.md`

---

### Step 4 — Repo Input Interfaces `src/db/repositories/<platform>Repo.ts`

Write the `*Input` interfaces by reading the Prisma model field names directly.
Field names in the interface must match Prisma field names exactly (camelCase).

**Rule:** If you cannot find the field name in `schema.prisma`, it does not belong in the interface.

```ts
// Prisma model has:  orderNumber  String  @map("order_number")
// Interface must have:
export interface OrderInput {
  orderNumber: string;   // ← exact match to Prisma field name
}
```

---

### Step 5 — Transformers `src/transform/<platform>/<resource>Transformer.ts`

Write after the repo interface exists. Import and declare the return type explicitly.
TypeScript will then catch any mismatch between transformer output and repo input at compile time.

```ts
import { OrderInput } from '../../db/repositories/<platform>Repo';

export function transformOrder(raw: PlatformOrder, syncedAt: Date): OrderInput {
  return {
    // TS error here immediately if any field is wrong, missing, or mistyped
  };
}
```

**Never use an inferred return type on a transformer.** The explicit type is the compile-time contract.

**Nested arrays (line items, refunds, etc.) must have their own transformer function** — never map them inline in the worker:

```ts
// CORRECT — dedicated function with explicit return type
export function transformOrderLineItems(raw: PlatformOrder, syncedAt: Date): OrderLineItemInput[] {
  return raw.lineItems.map((li): OrderLineItemInput => ({ ... }));
}

// WRONG — inline mapping in worker bypasses the compile-time contract
const lineItems = raw.flatMap((r) => r.lineItems.map((li) => ({ field: li.field, ... })));
```

**Money fields from string-based APIs (Shopify GraphQL):**
```ts
// CORRECT — null guard required because money fields CAN be null
totalPrice: raw.totalPriceSet ? parseFloat(raw.totalPriceSet.shopMoney.amount) : null,

// WRONG — crashes if API returns null for this order
totalPrice: parseFloat(raw.totalPriceSet.shopMoney.amount),
```

---

### Step 6 — Adapters + API Client

#### API Client `src/adapters/<platform>/<platform>Client.ts`

- Token fetched once per logical operation — not per page
- For paginated adapters: create the client once outside the loop, pass it through via a shared `execute*WithClient()` function
- Rate limiting via response headers (not fixed sleep) where the platform provides them
- 401 interceptor: log error and re-throw (BullMQ handles retry)

```ts
// CORRECT — client created once per fetch call, reused across all pages
export async function fetchOrders(lastSyncedAt: Date | null): Promise<OrderNode[]> {
  const client = await createPlatformClient();  // ← one token lookup
  let cursor: string | null = null;
  do {
    const result = await executeQueryWithClient(client, QUERY, { cursor });
    // ...
  } while (cursor);
}

// WRONG — new token lookup on every page
do {
  const result = await executeQuery(QUERY, { cursor });  // creates new client internally
} while (cursor);
```

#### Adapters `src/adapters/<platform>/<resource>.ts`

- Pagination: cursor-based (`pageInfo.hasNextPage` + `pageInfo.endCursor`) for GraphQL platforms; page-number for REST
- Rate limiting: use header-based throttling (`checkAndRespectRateLimit`) where available — do NOT add a fixed `sleep(350)` on top of it (double-throttling wastes time)
- For platforms without header-based rate limiting (Cin7 REST): use `await sleep(350)` between pages
- Import `sleep` from `../../utils/sleep` — never inline

---

### Step 7 — Repository upsert functions

Add `upsert*` functions to the repo file after all interfaces are defined.
- Import `chunk` from `../../utils/chunk` — never inline
- Chunk size: 200 rows
- `ON DUPLICATE KEY UPDATE` on the natural unique key (`shopify_id`, `cin7_id`, etc.)
- SQL column names must match `@map` values in the schema exactly

---

### Step 8 — Worker `src/workers/<platform>Worker.ts`

- All local variables: `camelCase` (TypeScript convention — never `snake_case`)
- Queue name and job names from constants
- Full try/catch: `logQueued` + `logRunning` before the try block, `logFailure` in catch
- `setLastSyncedAt` **before** `logSuccess` — cursor advances before success is recorded
- If a job triggers another job (e.g. products → inventory): enqueue **after** `logSuccess`, not before
- Register the worker in `index.ts` via a side-effect import

```ts
// index.ts
import './src/workers/<platform>Worker';
```

**Scheduler gate:** Only add a scheduler entry for a job once the worker `case` for that job exists and `tsc --noEmit` passes. Add the entry commented out, uncomment at Step 9 only.

**Jobs triggered by other jobs (not cron):** Do NOT add a scheduler entry for them. The triggering job enqueues them directly:

```ts
case PLATFORM_JOBS.PRODUCTS: {
  // ... sync products ...
  await logSuccess(syncLog.id, { ... });
  // Inventory triggered here — not a cron
  await platformQueue.add(PLATFORM_JOBS.INVENTORY, {}, {
    jobId: `${PLATFORM_JOBS.INVENTORY}:${Date.now()}`,
  });
  break;
}
```

---

### Step 9 — Scheduler + index.ts

Add job schedules to `src/queue/scheduler.ts` using `JOBS.*` constants.
Add queue to Bull Board in `src/server/app.ts`.

**Never add a scheduler entry without a corresponding worker import in `index.ts`.** Jobs that are scheduled but have no worker will accumulate in the failed queue after max retries.

---

## Pre-Ship Verification Checklist

Before marking a platform integration complete, verify every item:

### Types
- [ ] Every money/price field is `Type | null` — null guard in transformer before `parseFloat`
- [ ] Every nested object field is `Type | null` (e.g. `ShopifyMoney | null`)
- [ ] All dates are `string` in API types, `Date` after transformer conversion

### Adapters
- [ ] API client created **once per fetch function call**, not once per page
- [ ] Rate limiting: header-based where available; `sleep(350)` only for platforms without headers
- [ ] No `sleep` import in adapters that use header-based rate limiting

### Transformers
- [ ] Every transformer has an explicit `: *Input` return type — never inferred
- [ ] Every nested array (line items, refunds, etc.) has its own `transform*` function
- [ ] No inline object construction in the worker for nested data
- [ ] All `parseFloat` / `parseInt` calls are guarded with a null check

### Worker
- [ ] All local variables are `camelCase`
- [ ] `logQueued` + `logRunning` called before `try` block
- [ ] `setLastSyncedAt` called before `logSuccess` in every case
- [ ] Jobs triggered by other jobs are enqueued after `logSuccess`, not before
- [ ] `default` case throws — unknown job names fail loudly

### Scheduler + Wiring
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Every scheduled job has a `case` in the worker
- [ ] Worker imported in `index.ts`
- [ ] Queue added to Bull Board in `app.ts`
- [ ] Jobs triggered by other jobs have **no** scheduler entry
- [ ] Scheduler entries use `JOBS.*` constants — no string literals
