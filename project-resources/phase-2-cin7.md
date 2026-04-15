# Phase 2 — Cin7 Integration
**Status:** ✅ Complete  
**Depends on:** Phase 1 complete (scaffold running, all tables created)

---

## Goal

Cin7 data syncing end-to-end into MySQL:
- Orders + line items, contacts, products, inventory, purchase orders, credit notes, stock adjustments, branches
- Delta sync working (only fetch records changed since last run)
- Rate limits respected (3/s, 350ms sleep between pages)
- Sync lifecycle logged to `sync_logs`
- `lastSyncedAt` updated on success only, before `logSuccess`

---

## Files (all created)

```
src/constants/cin7.ts
src/types/cin7.types.ts
src/adapters/cin7/cin7Client.ts
src/adapters/cin7/orders.ts
src/adapters/cin7/contacts.ts
src/adapters/cin7/products.ts
src/adapters/cin7/inventory.ts
src/adapters/cin7/purchaseOrders.ts
src/adapters/cin7/creditNotes.ts
src/adapters/cin7/stockAdjustments.ts
src/adapters/cin7/branches.ts
src/transform/cin7/orderTransformer.ts
src/transform/cin7/contactTransformer.ts
src/transform/cin7/productTransformer.ts
src/transform/cin7/inventoryTransformer.ts
src/transform/cin7/purchaseOrderTransformer.ts
src/transform/cin7/creditNoteTransformer.ts
src/transform/cin7/stockAdjustmentTransformer.ts
src/transform/cin7/branchTransformer.ts
src/db/repositories/cin7Repo.ts
src/workers/cin7Worker.ts
```

---

## Step 0 — Authentication

Cin7 Omni uses **Basic Authentication — no OAuth, no token expiry, no refresh**.

**Auth method:** Base64-encode `username:api_key`, pass as `Authorization: Basic <token>` on every request.

**Required env variables:**
```
CIN7_API_USERNAME=your_api_username
CIN7_API_KEY=your_api_key
```

**How to get credentials:**
1. Log in at https://go.cin7.com
2. Navigate to: `https://go.cin7.com/cloud/apiSetup/Default.aspx`
3. Copy your API Username
4. Click **Add New API Connection** — copy the generated API Key immediately

**How auth is applied — `cin7Client.ts`:**
```ts
import { config } from '../../config';
import { CIN7_BASE_URL } from '../../constants/cin7';

const encoded = Buffer.from(
  `${config.CIN7_API_USERNAME ?? ''}:${config.CIN7_API_KEY ?? ''}`
).toString('base64');

export const cin7Client = axios.create({
  baseURL: CIN7_BASE_URL,   // 'https://api.cin7.com/api'
  headers: { Authorization: `Basic ${encoded}` },
});
```

- Credentials read from `config` (validated at startup via zod), never from `process.env` directly
- The base64 string is static — it does not expire
- If you regenerate your API key in Cin7, update `CIN7_API_KEY` in `.env` and restart

---

## Step 1 — Constants

**File:** `src/constants/cin7.ts`

```ts
export const CIN7_PLATFORM = 'cin7';
export const CIN7_QUEUE    = 'cin7';
export const CIN7_BASE_URL = 'https://api.cin7.com/api';

export const CIN7_JOBS = {
  ORDERS:            'cin7:orders',
  CONTACTS:          'cin7:contacts',
  PRODUCTS:          'cin7:products',
  INVENTORY:         'cin7:inventory',
  PURCHASE_ORDERS:   'cin7:purchase-orders',
  CREDIT_NOTES:      'cin7:credit-notes',
  STOCK_ADJUSTMENTS: 'cin7:stock-adjustments',
  BRANCHES:          'cin7:branches',
} as const;
```

---

## Step 2 — TypeScript Types

**File:** `src/types/cin7.types.ts`

Key interfaces (actual field names from Cin7 API — note `updatedDate` not `modifiedDate`):

```ts
interface Cin7SalesOrder {
  id: number;
  reference: string;
  memberEmail: string | null;
  memberId: number | null;
  status: string;
  total: number;         // total amount
  tax: number;           // tax total
  subTotal: number;      // line item total
  shippingCost: number | null;
  priceTier: string | null;   // payment terms
  branchId: number;
  currencyCode: string;
  createdDate: string;   // ISO string
  updatedDate: string;   // ISO string — used as modifiedDate for delta sync
  lineItems: Cin7LineItem[];
}

interface Cin7LineItem {
  id: number;
  productId: number;
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  tax: number;
  total: number;
  lineItemType: string;
  sortOrder: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  styleCode: string | null;
  barcode: string | null;
  taxRule: string | null;
  accountCode: string | null;
  comment: string | null;
}
```

All dates are `string` (raw API format). Nullable fields use `Type | null`.

---

## Step 3 — Adapter Functions

**Pattern — delta endpoints (orders, contacts, products, purchaseOrders, creditNotes, stockAdjustments):**
```ts
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchOrders(lastSyncedAt: Date | null): Promise<Cin7SalesOrder[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7SalesOrder[] = [];

  const where = lastSyncedAt
    ? `modifiedDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7SalesOrder[]>('/v1/SalesOrders', {
      params: { page, rows, ...(where !== undefined && { where }), order: 'modifiedDate ASC' },
    });

    logger.info({ platform: CIN7_PLATFORM, module: 'orders', page, fetched: data.length });
    results.push(...data);
    if (data.length < rows) break;

    page++;
    await sleep(350);
  }

  return results;
}
```

**Pattern — full refresh endpoints (inventory, branches):**
```ts
// No lastSyncedAt param, no where clause, no order param
// /v1/Stock and /v1/Branches do not support modifiedDate filtering or ordering
export async function fetchInventory(): Promise<Cin7StockItem[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7StockItem[] = [];

  while (true) {
    const { data } = await cin7Client.get<Cin7StockItem[]>('/v1/Stock', {
      params: { page, rows },
    });

    logger.info({ platform: CIN7_PLATFORM, module: 'inventory', page, fetched: data.length });
    results.push(...data);
    if (data.length < rows) break;

    page++;
    await sleep(350);
  }

  return results;
}
```

**Endpoints and delta field:**

| File | Endpoint | Delta field | Full refresh? |
|---|---|---|---|
| `orders.ts` | `GET /v1/SalesOrders` | `modifiedDate` | No |
| `contacts.ts` | `GET /v1/Contacts` | `modifiedDate` | No |
| `products.ts` | `GET /v1/Products` | `modifiedDate` | No |
| `inventory.ts` | `GET /v1/Stock` | — | **Yes** |
| `purchaseOrders.ts` | `GET /v1/PurchaseOrders` | `modifiedDate` | No |
| `creditNotes.ts` | `GET /v1/CreditNotes` | `modifiedDate` | No |
| `stockAdjustments.ts` | `GET /v1/Adjustments` | `createdDate` (not `modifiedDate`) | No |
| `branches.ts` | `GET /v1/Branches` | — | **Yes** |

> **Note:** Stock adjustments endpoint is `/v1/Adjustments` (not `/v1/StockAdjustments`), and filters on `createdDate`, not `modifiedDate`.

---

## Step 4 — Transformers

Each transformer imports and explicitly declares its repo `*Input` return type.
This creates a compile-time contract — TypeScript errors immediately if any field is wrong.

```ts
import { Cin7SalesOrder } from '../../types/cin7.types';
import { OrderInput } from '../../db/repositories/cin7Repo';

export function transformOrder(raw: Cin7SalesOrder, syncedAt: Date): OrderInput {
  return {
    cin7Id:        raw.id,
    orderNumber:   raw.reference,
    customerEmail: raw.memberEmail ?? null,
    cin7MemberId:  raw.memberId ?? null,
    status:        raw.status,
    totalAmount:   raw.total,
    taxTotal:      raw.tax,
    lineItemTotal: raw.subTotal,
    shippingTotal: raw.shippingCost ?? null,
    paymentTerms:  raw.priceTier ?? null,
    branchId:      raw.branchId,
    currency:      raw.currencyCode,
    orderDate:     new Date(raw.createdDate),
    modifiedDate:  new Date(raw.updatedDate),  // Cin7 returns 'updatedDate', stored as modified_date
    rawData:       raw,
    syncedAt,
  };
}
```

**Rule:** Never use inferred return types on transformers. The explicit `: *Input` type is the contract.

Line items are transformed by a **dedicated function** (`transformOrderLineItems`) — never mapped inline in the worker. The dedicated function has an explicit return type so TypeScript catches field mismatches at compile time.

```ts
export function transformOrderLineItems(raw: Cin7SalesOrder, syncedAt: Date): OrderLineItemInput[] {
  return raw.lineItems.map((li): OrderLineItemInput => ({
    orderId:         raw.id,
    cin7LineItemId:  li.id,
    // ... all fields explicitly typed
    syncedAt,
  }));
}
```

---

## Step 5 — Repository

**File:** `src/db/repositories/cin7Repo.ts`

- `*Input` interfaces — field names match Prisma model field names (camelCase)
- `upsert*` functions — bulk INSERT ... ON DUPLICATE KEY UPDATE via `Prisma.sql` + `Prisma.join`
- Chunk size: 200 rows — uses `import { chunk } from '../../utils/chunk'`
- Returns `Promise<number>` (count of rows processed)

```ts
import { chunk } from '../../utils/chunk';

export async function upsertOrders(rows: OrderInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(c.map((r) => Prisma.sql`(...)`));
    await prisma.$executeRaw`INSERT INTO cin7_orders (...) VALUES ${values} ON DUPLICATE KEY UPDATE ...`;
    saved += c.length;
  }
  return saved;
}
```

---

## Step 6 — Worker

**File:** `src/workers/cin7Worker.ts`

Key points:
- Queue name and all job names from `CIN7_JOBS` constants — no inline strings
- `logQueued` + `logRunning` inside the try/catch — failure is always recorded
- `setLastSyncedAt` called **before** `logSuccess` — cursor advances before success is written
- Line items mapped inline in the `ORDERS` case from `raw.lineItems`
- `default` throws — unknown job names fail loudly and are retried by BullMQ

```ts
// ALL local variables must be camelCase — TypeScript convention, enforced by project rules.
// Never use snake_case for local variables (started_at, sync_log, etc.) — use startedAt, syncLog.
export const cin7Worker = new Worker(
  CIN7_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: CIN7_PLATFORM, job: job.name }, 'job started');
    const queuedId = await logQueued(CIN7_PLATFORM, job.name);
    const syncLog  = await logRunning(queuedId);

    try {
      const lastSyncedAt = await getLastSyncedAt(CIN7_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case CIN7_JOBS.ORDERS: {
          const raw       = await fetchOrders(lastSyncedAt);
          const orders    = raw.map((r) => transformOrder(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformOrderLineItems(r, syncedAt));
          const recordsSaved = await upsertOrders(orders);
          await upsertOrderLineItems(lineItems);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }
        // ... other cases follow same pattern
        default:
          throw new Error(`cin7Worker: unknown job name: ${job.name}`);
      }
    } catch (error) {
      await logFailure(syncLog.id, {
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
  { connection, concurrency: 2, limiter: { max: 3, duration: 1000 } },
);
```

Worker is registered in `index.ts` as a side-effect import:
```ts
import './src/workers/cin7Worker';
```

---

## API Rate Limits & Pagination

### Rate Limits

| Limit | Value | Enforcement |
|---|---|---|
| Max requests/second | 3 req/s | BullMQ worker limiter: `{ max: 3, duration: 1000 }` |
| Inter-page sleep | 350ms | `await sleep(350)` — import from `../../utils/sleep`, never inline |
| Retry on failure | 3 attempts | BullMQ exponential backoff (5s, 10s, 20s) |

Cin7 does not return a `429` status when rate-limited — it may return `503` or silently drop requests. The 350ms sleep is a hard guard, not reactive. Do not remove it.

### Pagination

All endpoints use offset pagination (`page` + `rows`):

| Param | Value |
|---|---|
| `page` | starts at `1`, 1-indexed |
| `rows` | `250` (max page size) |
| Terminal condition | `data.length < rows` |

---

## Pre-Ship Checklist

### Types
- [ ] Every nullable field uses `Type | null` — no `Type | undefined`
- [ ] All dates are `string` in API types, `Date` after transformer

### Adapters
- [ ] `sleep(350)` between pages — imported from `../../utils/sleep`, never inlined
- [ ] Page size `250` — no endpoint uses a different value
- [ ] Delta filter uses correct field name per endpoint (`modifiedDate` vs `createdDate` for adjustments)

### Transformers
- [ ] Every transformer has explicit `: *Input` return type — never inferred
- [ ] Line items use `transformOrderLineItems` (dedicated function) — never inline in worker
- [ ] All `?? null` guards on nullable fields

### Worker
- [ ] All local variables `camelCase` — never `snake_case` (startedAt not started_at)
- [ ] `logger.info` before `logQueued` at job start
- [ ] `logQueued` + `logRunning` before `try` block
- [ ] `setLastSyncedAt` before `logSuccess` in every case
- [ ] `default` case throws

### Scheduler + Wiring
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Every scheduled job has a `case` in the worker
- [ ] Worker imported in `index.ts`
- [ ] No hardcoded job/queue/platform strings

---

## Verification

```bash
# 1. Trigger a manual one-off sync via Bull Board
# Open http://localhost:3000/admin/queues
# Click cin7 queue → "Add Job" → name: "cin7:orders", data: {}

# 2. Check sync_logs
SELECT platform, job_type, status, records_fetched, records_saved, duration_ms
FROM sync_logs ORDER BY created_at DESC LIMIT 10;
-- Expected: status='success', records_fetched > 0

# 3. Check data landed
SELECT COUNT(*) FROM cin7_orders;
SELECT COUNT(*) FROM cin7_order_line_items;
SELECT COUNT(*) FROM cin7_contacts;
SELECT COUNT(*) FROM cin7_products;
SELECT COUNT(*) FROM cin7_inventory;
SELECT COUNT(*) FROM cin7_purchase_orders;
SELECT COUNT(*) FROM cin7_credit_notes;
SELECT COUNT(*) FROM cin7_stock_adjustments;
SELECT COUNT(*) FROM cin7_branches;

# 4. Check sync_config lastSyncedAt updated
SELECT platform, job_type, last_synced_at FROM sync_config WHERE platform = 'cin7';
-- Expected: last_synced_at is set for all 8 job types

# 5. Trigger a second sync — should fetch 0 or only new records
# add job again, check records_fetched = 0 (delta working)

# 6. Test failure path — set wrong CIN7_API_KEY in .env
# Job should fail 3 times, sync_logs shows status='failed' with error_message
# last_synced_at must NOT be updated on failure
```

---

## Done Criteria

- [x] All 9 Cin7 tables populated after first sync
- [x] `sync_logs` shows `status='success'` for all job types
- [x] `sync_config.last_synced_at` updated for all 8 Cin7 job types
- [x] Second sync fetches 0 records (delta working)
- [x] Line items extracted from orders without extra API call
- [x] Failed sync does NOT update `last_synced_at`
- [x] Bull Board shows completed jobs with correct record counts
- [x] All transformers have explicit `: *Input` return types
- [x] No inline `sleep` or `chunk` — all from `src/utils/`
- [x] No hardcoded platform strings — all from `src/constants/cin7.ts`
