# Phase 5 — Google Analytics 4 Integration
**Status:** ✅ Complete  
**Depends on:** Phase 1 complete  

---

## Goal

GA4 data syncing daily:
- Traffic / User Behaviour (sessions, new/returning users, page views, engagement time, source/medium/campaign, device)
- Ecommerce events (view_item, add-to-cart, checkout, purchases, revenue — per source/medium)
- Product-level data (impressions, list clicks, detail views, add-to-carts, purchases, revenue per item)
- Always syncs `yesterday` — 24–48h processing delay means today's data is incomplete
- 3 `runReport` API calls total per day (one per module)

---

## Files to Create (in order)

```
src/constants/ga4.ts                              ← Step 1 — do this first
src/types/ga4.types.ts
prisma/schema.prisma                              ← add GA4 models, run migration
src/adapters/ga4/ga4Client.ts
src/adapters/ga4/sessions.ts
src/adapters/ga4/ecommerceEvents.ts
src/adapters/ga4/productData.ts
src/transform/ga4/sessionTransformer.ts
src/transform/ga4/ecommerceEventTransformer.ts
src/transform/ga4/productDataTransformer.ts
src/db/repositories/ga4Repo.ts
src/workers/ga4Worker.ts
```

> **Schema-first rule:** Add GA4 models to `prisma/schema.prisma` and run the migration **before** writing any repo interfaces, transformers, or worker code. The migration is the gate.
> 
> **Always run migrations inside the Docker container** — never on the host directly, or you get root-owned files that block future edits:
> ```bash
> docker exec -it NimbleAPI npx prisma migrate dev --name add_ga4_tables
> sudo chown -R $USER:$USER prisma/migrations/
> ```

---

## Step-by-Step Build

### Step 0 — Authentication Setup

GA4 uses a **Service Account JSON key — the SDK handles all token refresh automatically, no manual token management needed**.

**How it works:**
1. Service Account JSON key (stored in env) — **never expires** by default
2. SDK signs a JWT using the private key → exchanges with Google auth server → gets an **access token (1 hour TTL)**
3. When the access token expires, the SDK automatically signs a new JWT and fetches a fresh token
4. No refresh tokens, no DB storage, no developer action needed — fully transparent

**Required env variables (already in `src/config/index.ts`):**
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
GA4_PROPERTY_ID=123456789
```

**Where to get:**
1. Go to https://console.cloud.google.com → create or select a project
2. APIs & Services → Library → search **"Google Analytics Data API"** → Enable
3. APIs & Services → Credentials → Create Credentials → Service Account
4. Under the service account → Keys tab → Add Key → JSON → Download the file
5. Stringify the entire JSON file contents → set as `GOOGLE_SERVICE_ACCOUNT_JSON`
6. Go to https://analytics.google.com → Admin → Property Settings → copy the **Property ID** (numeric)
7. In GA4 → Admin → Account Access Management → Add the **service account email** as **Viewer**
   > If this step is skipped, all API calls return 403

**Key notes:**
- No `platform_tokens` DB entry needed — GA4 is the only platform that bypasses `tokenManager.ts`
- Credentials always read from `config.*` — never from `process.env` directly
- Install: `npm install @google-analytics/data`

---

### Step 1 — Constants

**File:** `src/constants/ga4.ts`

```ts
export const GA4_PLATFORM = 'ga4';
export const GA4_QUEUE    = 'ga4';

export const GA4_JOBS = {
  DAILY: 'ga4:daily',
} as const;
```

---

### Step 2 — TypeScript Types

**File:** `src/types/ga4.types.ts`

GA4 API returns rows as arrays of dimension/metric values (not named fields). All fields `Type | null` by default:

```ts
export interface GA4DimensionHeader {
  name: string | null;
}

export interface GA4MetricHeader {
  name: string | null;
  type: string | null;
}

export interface GA4DimensionValue {
  value: string | null;
}

export interface GA4MetricValue {
  value: string | null;
}

export interface GA4ReportRow {
  dimensionValues: Array<GA4DimensionValue> | null;
  metricValues: Array<GA4MetricValue> | null;
}

export interface GA4PropertyQuota {
  tokensPerDay: { consumed: number | null; remaining: number | null } | null;
  tokensPerHour: { consumed: number | null; remaining: number | null } | null;
}

export interface GA4ReportResponse {
  rows: Array<GA4ReportRow> | null;
  rowCount: number | null;
  dimensionHeaders: Array<GA4DimensionHeader> | null;
  metricHeaders: Array<GA4MetricHeader> | null;
  propertyQuota: GA4PropertyQuota | null;
}

// Typed rows after parsing — intermediate shape between adapter and transformer
export interface GA4SessionRow {
  date: string;             // YYYYMMDD from API
  source: string;           // "(not set)" stored as-is
  medium: string;
  campaign: string;
  deviceCategory: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  pageViews: number;
  engagementSeconds: number;
}

export interface GA4EcommerceEventRow {
  date: string;             // YYYYMMDD from API
  eventName: string;        // "add_to_cart" | "begin_checkout" | "purchase" | "view_item"
  source: string;
  medium: string;
  transactions: number;
  revenue: number;          // parse as float — stored as Decimal(12, 2)
  addToCarts: number;
  checkouts: number;
  viewItemEvents: number;   // eventCount for view_item rows; 0 for other event types
}

export interface GA4ProductDataRow {
  date: string;             // YYYYMMDD from API
  itemId: string | null;    // may be "(not set)" — transformer applies sentinel before DB
  itemName: string | null;
  itemBrand: string | null;
  itemCategory: string | null;
  itemListViews: number;    // product impressions — times product appeared in a list
  itemListClicks: number;   // clicks from a product list to the product detail page
  itemViews: number;        // product detail page views
  addToCarts: number;
  purchases: number;
  revenue: number;          // parse as float — stored as Decimal(12, 2)
}
```

---

### Step 3 — Schema + Migration (gate)

Add all GA4 models to `prisma/schema.prisma`. Per the rules:
- GA4 is an analytics/reporting table — **omit `srcCreatedAt`/`srcModifiedAt`** (no source timestamps)
- Unique key per table is the composite of `propertyId + reportDate + dimension columns`
- All timestamps use `DateTime @db.DateTime(3)` — never `@db.Date`
- All money/revenue fields: `Decimal @db.Decimal(12, 2)`
- All integer count fields: `Int`
- `propertyId` stored as `String @db.VarChar(50)` (numeric GA4 property IDs are still strings)
- `rawData Json @map("raw_data")` on every table
- Required indexes: `syncedAt` (no `srcModifiedAt` on analytics tables)

```prisma
model Ga4Session {
  id                BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  propertyId        String   @map("property_id") @db.VarChar(50)
  reportDate        DateTime @map("report_date") @db.DateTime(3)
  source            String   @db.VarChar(100)
  medium            String   @db.VarChar(100)
  campaign          String   @db.VarChar(100)
  deviceCategory    String   @map("device_category") @db.VarChar(50)
  sessions          Int
  totalUsers        Int      @map("total_users")
  newUsers          Int      @map("new_users")
  pageViews         Int      @map("page_views")
  engagementSeconds Int      @map("engagement_seconds")
  rawData           Json     @map("raw_data")
  syncedAt          DateTime @map("synced_at") @db.DateTime(3)
  createdAt         DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt        DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([propertyId, reportDate, source, medium, campaign, deviceCategory], map: "uq_ga4_sessions_key")
  @@index([reportDate], map: "idx_ga4_sessions_report_date")
  @@index([syncedAt], map: "idx_ga4_sessions_synced_at")
  @@map("ga4_sessions")
}

model Ga4EcommerceEvent {
  id           BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  propertyId   String   @map("property_id") @db.VarChar(50)
  reportDate   DateTime @map("report_date") @db.DateTime(3)
  eventName    String   @map("event_name") @db.VarChar(100)
  source       String   @db.VarChar(100)
  medium       String   @db.VarChar(100)
  transactions    Int
  revenue         Decimal  @db.Decimal(12, 2)
  addToCarts      Int      @map("add_to_carts")
  checkouts       Int
  viewItemEvents  Int      @map("view_item_events")
  rawData         Json     @map("raw_data")
  syncedAt        DateTime @map("synced_at") @db.DateTime(3)
  createdAt       DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt      DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([propertyId, reportDate, eventName, source, medium], map: "uq_ga4_ecommerce_events_key")
  @@index([reportDate], map: "idx_ga4_ecommerce_events_report_date")
  @@index([syncedAt], map: "idx_ga4_ecommerce_events_synced_at")
  @@map("ga4_ecommerce_events")
}

model Ga4ProductData {
  id           BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  propertyId   String   @map("property_id") @db.VarChar(50)
  reportDate   DateTime @map("report_date") @db.DateTime(3)
  itemId         String   @map("item_id") @db.VarChar(100)
  itemName       String   @map("item_name") @db.VarChar(255)
  itemBrand      String?  @map("item_brand") @db.VarChar(255)
  itemCategory   String?  @map("item_category") @db.VarChar(255)
  itemListViews  Int      @map("item_list_views")
  itemListClicks Int      @map("item_list_clicks")
  itemViews      Int      @map("item_views")
  addToCarts     Int      @map("add_to_carts")
  purchases      Int
  revenue        Decimal  @db.Decimal(12, 2)
  rawData      Json     @map("raw_data")
  syncedAt     DateTime @map("synced_at") @db.DateTime(3)
  createdAt    DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt   DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([propertyId, reportDate, itemId, itemName], map: "uq_ga4_product_data_key")
  @@index([reportDate], map: "idx_ga4_product_data_report_date")
  @@index([syncedAt], map: "idx_ga4_product_data_synced_at")
  @@map("ga4_product_data")
}
```

> **Why `source`/`medium`/`campaign` are `VarChar(100)` not `VarChar(255)`:** MySQL InnoDB's index key limit is 3072 bytes. With `utf8mb4` (4 bytes/char), 3× `VarChar(255)` in a composite unique index = 3,060 bytes — exceeding the limit and causing migration failure `Error 1071`. GA4 dimension values are well under 100 chars.
>
> **Why `itemId`/`itemName` are non-nullable:** MySQL's unique index treats `NULL != NULL`, so two rows where both are `NULL` are considered distinct — the `ON DUPLICATE KEY UPDATE` never fires and you get unlimited duplicate inserts instead of upserts. Use `'(not set)'` sentinel in the transformer.

Then run (always inside Docker):
```bash
docker exec -it NimbleAPI npx prisma migrate dev --name add_ga4_tables
sudo chown -R $USER:$USER prisma/migrations/
```

**Do not proceed to Step 4 until the migration has run and all 3 tables exist in the DB.**

---

### Step 4 — API Client

**File:** `src/adapters/ga4/ga4Client.ts`

Uses `@google-analytics/data` SDK (not raw axios). SDK handles token refresh automatically:

```ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { GA4ReportResponse } from '../../types/ga4.types';

// IMPORTANT: use truthiness check, not ?? — empty string "" passes ?? but fails JSON.parse
function createAnalyticsClient(): BetaAnalyticsDataClient {
  const raw = config.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = raw ? JSON.parse(raw) : {};
  return new BetaAnalyticsDataClient({ credentials });
}

export const analyticsDataClient = createAnalyticsClient();

export async function runReport(
  propertyId: string,
  requestBody: object,
): Promise<GA4ReportResponse> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    ...requestBody,
  });

  const quota = response.propertyQuota;
  if (quota) {
    const remaining = quota.tokensPerDay?.remaining ?? null;
    if (remaining !== null && remaining < 1000) {
      logger.warn({ platform: GA4_PLATFORM, tokensPerDayRemaining: remaining }, 'GA4 quota low');
    } else {
      logger.info({
        platform: GA4_PLATFORM,
        tokensPerDayRemaining: remaining,
        tokensPerHourRemaining: quota.tokensPerHour?.remaining ?? null,
      }, 'GA4 quota');
    }
  }

  return response as GA4ReportResponse;
}

// Parse rows from GA4 response into named objects
export function parseRows<T>(
  response: GA4ReportResponse,
  mapper: (row: Record<string, string>) => T,
): T[] {
  if (!response.rows) return [];

  return response.rows.map((row) => {
    const named: Record<string, string> = {};
    (response.dimensionHeaders ?? []).forEach((h, i) => {
      named[h.name ?? ''] = row.dimensionValues?.[i]?.value ?? '';
    });
    (response.metricHeaders ?? []).forEach((h, i) => {
      named[h.name ?? ''] = row.metricValues?.[i]?.value ?? '0';
    });
    return mapper(named);
  });
}
```

---

### Step 5 — Adapter Functions

All 3 adapters follow identical pattern — they differ only in the request body. No pagination needed for most properties (single `runReport` call returns all rows). Rate limiting is token-based and logged after each call — no `sleep` needed.

**File:** `src/adapters/ga4/sessions.ts`

```ts
import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReport, parseRows } from './ga4Client';
import { GA4SessionRow } from '../../types/ga4.types';

export async function fetchSessions(date: string): Promise<GA4SessionRow[]> {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'deviceCategory' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'userEngagementDuration' },
    ],
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'sessions', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:              row['date'],
    source:            row['sessionSource'],
    medium:            row['sessionMedium'],
    campaign:          row['sessionCampaignName'],
    deviceCategory:    row['deviceCategory'],
    sessions:          parseInt(row['sessions'], 10),
    totalUsers:        parseInt(row['totalUsers'], 10),
    newUsers:          parseInt(row['newUsers'], 10),
    pageViews:         parseInt(row['screenPageViews'], 10),
    engagementSeconds: parseInt(row['userEngagementDuration'], 10),
  }));
}
```

**File:** `src/adapters/ga4/ecommerceEvents.ts`

```ts
import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReport, parseRows } from './ga4Client';
import { GA4EcommerceEventRow } from '../../types/ga4.types';

export async function fetchEcommerceEvents(date: string): Promise<GA4EcommerceEventRow[]> {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'eventName' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'transactions' },
      { name: 'purchaseRevenue' },
      { name: 'addToCarts' },
      { name: 'checkouts' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['add_to_cart', 'begin_checkout', 'purchase'],
        },
      },
    },
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'ecommerceEvents', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:         row['date'],
    eventName:    row['eventName'],
    source:       row['sessionSource'],
    medium:       row['sessionMedium'],
    transactions: parseInt(row['transactions'], 10),
    revenue:      parseFloat(row['purchaseRevenue']),
    addToCarts:   parseInt(row['addToCarts'], 10),
    checkouts:    parseInt(row['checkouts'], 10),
  }));
}
```

**File:** `src/adapters/ga4/productData.ts`

```ts
import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReport, parseRows } from './ga4Client';
import { GA4ProductDataRow } from '../../types/ga4.types';

export async function fetchProductData(date: string): Promise<GA4ProductDataRow[]> {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'itemId' },
      { name: 'itemName' },
      { name: 'itemBrand' },
      { name: 'itemCategory' },
    ],
    metrics: [
      { name: 'itemViews' },
      { name: 'addToCarts' },
      { name: 'itemsPurchased' },
      { name: 'itemRevenue' },
    ],
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'productData', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:         row['date'],
    itemId:       row['itemId'] || null,    // stays nullable here — transformer applies sentinel
    itemName:     row['itemName'] || null,
    itemBrand:    row['itemBrand'] || null,
    itemCategory: row['itemCategory'] || null,
    itemViews:    parseInt(row['itemViews'], 10),
    addToCarts:   parseInt(row['addToCarts'], 10),
    purchases:    parseInt(row['itemsPurchased'], 10),
    revenue:      parseFloat(row['itemRevenue']),
  }));
}
```

**Date helper** — used in worker, not in adapters:

```ts
function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];  // "YYYY-MM-DD"
}
```

---

### Step 6 — Transformers

All 3 transformers share the same rules:
- **Explicit `: *Input` return type required** — never inferred
- `"(not set)"` stored as-is — never convert to `null`
- GA4 date (`YYYYMMDD`) → `DateTime` via helper function
- Revenue/money fields: `parseFloat` (already guarded — `GA4ProductDataRow.revenue` is `number`)
- `rawData: raw` — pass the full row object

**File:** `src/transform/ga4/sessionTransformer.ts`

```ts
import { GA4SessionRow } from '../../types/ga4.types';
import { SessionInput } from '../../db/repositories/ga4Repo';

export function transformSession(
  raw: GA4SessionRow,
  propertyId: string,
  syncedAt: Date,
): SessionInput {
  return {
    propertyId,
    reportDate:        parseGa4Date(raw.date),
    source:            raw.source,           // store "(not set)" as-is
    medium:            raw.medium,
    campaign:          raw.campaign,
    deviceCategory:    raw.deviceCategory,
    sessions:          raw.sessions,
    totalUsers:        raw.totalUsers,
    newUsers:          raw.newUsers,
    pageViews:         raw.pageViews,
    engagementSeconds: raw.engagementSeconds,
    rawData:           raw,
    syncedAt,
  };
}

function parseGa4Date(yyyymmdd: string): Date {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}
```

Same explicit return type pattern for `ecommerceEventTransformer.ts` and `productDataTransformer.ts`. Each transformer has its own `parseGa4Date` — do not share it via a util unless it is used in 3+ files.

**`productDataTransformer.ts`** — apply `'(not set)'` sentinel for nullable ID/name fields:

```ts
import { GA4ProductDataRow } from '../../types/ga4.types';
import { ProductDataInput } from '../../db/repositories/ga4Repo';

export function transformProductData(
  raw: GA4ProductDataRow,
  propertyId: string,
  syncedAt: Date,
): ProductDataInput {
  return {
    propertyId,
    reportDate:   parseGa4Date(raw.date),
    itemId:       raw.itemId ?? '(not set)',    // sentinel — NULL breaks ON DUPLICATE KEY UPDATE
    itemName:     raw.itemName ?? '(not set)',  // sentinel — NULL breaks ON DUPLICATE KEY UPDATE
    itemBrand:    raw.itemBrand,
    itemCategory: raw.itemCategory,
    itemViews:    raw.itemViews,
    addToCarts:   raw.addToCarts,
    purchases:    raw.purchases,
    revenue:      raw.revenue,
    rawData:      raw,
    syncedAt,
  };
}

function parseGa4Date(yyyymmdd: string): Date {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}
```

---

### Step 7 — Repository

**File:** `src/db/repositories/ga4Repo.ts`

- Export `*Input` interfaces — field names match Prisma model field names exactly (`camelCase`)
- Chunk size: 200 rows — `import { chunk } from '../../utils/chunk'`
- `ON DUPLICATE KEY UPDATE` on the composite unique key per table
- Returns `Promise<number>`

```ts
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

export interface SessionInput {
  propertyId: string;
  reportDate: Date;
  source: string;
  medium: string;
  campaign: string;
  deviceCategory: string;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  pageViews: number;
  engagementSeconds: number;
  rawData: object;
  syncedAt: Date;
}

export interface EcommerceEventInput {
  propertyId: string;
  reportDate: Date;
  eventName: string;
  source: string;
  medium: string;
  transactions: number;
  revenue: number;
  addToCarts: number;
  checkouts: number;
  viewItemEvents: number;
  rawData: object;
  syncedAt: Date;
}

export interface ProductDataInput {
  propertyId: string;
  reportDate: Date;
  itemId: string;         // never null — use '(not set)' sentinel; NULL breaks unique index
  itemName: string;       // never null — use '(not set)' sentinel; NULL breaks unique index
  itemBrand: string | null;
  itemCategory: string | null;
  itemListViews: number;
  itemListClicks: number;
  itemViews: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
  rawData: object;
  syncedAt: Date;
}

export async function upsertSessions(rows: SessionInput[]): Promise<number> { ... }
export async function upsertEcommerceEvents(rows: EcommerceEventInput[]): Promise<number> { ... }
export async function upsertProductData(rows: ProductDataInput[]): Promise<number> { ... }
```

Upsert functions use `Prisma.sql` + `Prisma.join` with `ON DUPLICATE KEY UPDATE`. SQL column names must match `@map` values in the schema exactly (snake_case).

---

### Step 8 — Worker

**File:** `src/workers/ga4Worker.ts`

```ts
import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { GA4_PLATFORM, GA4_QUEUE, GA4_JOBS } from '../constants/ga4';
import { config } from '../config';
import { fetchSessions } from '../adapters/ga4/sessions';
import { fetchEcommerceEvents } from '../adapters/ga4/ecommerceEvents';
import { fetchProductData } from '../adapters/ga4/productData';
import { transformSession } from '../transform/ga4/sessionTransformer';
import { transformEcommerceEvent } from '../transform/ga4/ecommerceEventTransformer';
import { transformProductData } from '../transform/ga4/productDataTransformer';
import { upsertSessions, upsertEcommerceEvents, upsertProductData } from '../db/repositories/ga4Repo';
import { setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

export const ga4Worker = new Worker(
  GA4_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: GA4_PLATFORM, job: job.name }, 'job started');
    const queuedId = await logQueued(GA4_PLATFORM, job.name);
    const syncLog  = await logRunning(queuedId);

    try {
      const syncedAt = new Date();

      switch (job.name) {
        case GA4_JOBS.DAILY: {
          const date       = getYesterdayDate();
          const propertyId = config.GA4_PROPERTY_ID ?? '';

          const [rawSessions, rawEcommerce, rawProducts] = await Promise.all([
            fetchSessions(date),
            fetchEcommerceEvents(date),
            fetchProductData(date),
          ]);

          const sessionRows  = rawSessions.map((r) => transformSession(r, propertyId, syncedAt));
          const ecommerceRows = rawEcommerce.map((r) => transformEcommerceEvent(r, propertyId, syncedAt));
          const productRows  = rawProducts.map((r) => transformProductData(r, propertyId, syncedAt));

          const sessionsSaved   = await upsertSessions(sessionRows);
          const ecommerceSaved  = await upsertEcommerceEvents(ecommerceRows);
          const productsSaved   = await upsertProductData(productRows);

          // GA4 always syncs yesterday — no delta cursor needed, but we update for audit trail
          await setLastSyncedAt(GA4_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: rawSessions.length + rawEcommerce.length + rawProducts.length,
            recordsSaved:   sessionsSaved + ecommerceSaved + productsSaved,
            recordsSkipped: 0,
            durationMs:     Date.now() - startedAt,
          });
          break;
        }

        default:
          throw new Error(`ga4Worker: unknown job name: ${job.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logFailure(syncLog.id, {
        errorMessage,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
  { connection, concurrency: 2, limiter: { max: 5, duration: 1000 } },
);

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
```

**Worker registration** — add to `index.ts` as a side-effect import:

```ts
import './src/workers/ga4Worker';
```

**Key worker rules:**
- `logQueued` + `logRunning` called before `try` — failure is always recorded
- All local variables `camelCase` — never `snake_case`
- `setLastSyncedAt` called **before** `logSuccess` — cursor advances before success is written
- `default` throws — unknown job names fail loudly and are retried by BullMQ
- GA4 always syncs yesterday's date — `getLastSyncedAt` not used as a delta filter

---

### Step 9 — Scheduler + index.ts

**`src/queue/scheduler.ts`** — uncomment the GA4 entry (already present as a comment):

```ts
import { ga4Queue } from './queues';
import { GA4_JOBS } from '../constants/ga4';

// Inside registerSchedulers():
ga4Queue.add(GA4_JOBS.DAILY, {}, { repeat: { pattern: '0 3 * * *' } }),
```

**`src/server/app.ts`** — add `ga4Queue` to Bull Board alongside existing queues.

**Never uncomment the scheduler entry until the worker `case` exists and `tsc --noEmit` passes.**

---

## API Rate Limits & Pagination

### Rate Limits

GA4 uses a **token-based quota system** (not req/second):

| Quota | Limit | Notes |
|---|---|---|
| Tokens per day | 250,000 | Shared across all `runReport` calls for this property |
| Tokens per hour | 50,000 | Rolling 1-hour window |
| Concurrent requests | 10 | Per property |
| BullMQ worker limiter | `{ max: 5, duration: 1000 }` | Secondary guard |

**Quota tracking:** Every `runReport` response includes `propertyQuota`. Log values after each call. If `tokensPerDay.remaining < 1000`, log a `WARN`. On quota exhaustion (HTTP `429` / `RESOURCE_EXHAUSTED`): the SDK throws — BullMQ handles retry. Daily cron means the next attempt is the following day when quota resets.

### Pagination

GA4 `runReport` returns all matching rows in a single response for most properties. If `rowCount > rows.length`, use `offset` + `limit` pagination:

```ts
const PAGE_SIZE = 100_000;
let offset = 0;
let allRows: GA4SessionRow[] = [];

do {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
    ...requestBody,
    limit: PAGE_SIZE,
    offset,
  });
  allRows.push(...parseRows(response, mapper));
  offset += PAGE_SIZE;
} while (offset < (response.rowCount ?? 0));
```

Only add offset pagination if you observe `rowCount > rows.length` in the response.

---

## Pre-Ship Verification Checklist

### Types
- [ ] Every money/revenue field is guarded before use (`parseFloat` on a `string` from GA4 rows)
- [ ] All `GA4*Row` fields sized correctly per `datatypes.md`
- [ ] `itemId`/`itemName` are **non-nullable** in schema and `ProductDataInput` — transformer uses `?? '(not set)'` sentinel
- [ ] `itemBrand`/`itemCategory` nullable in both type and Prisma model

### Adapters
- [ ] `analyticsDataClient` created once at module load — not once per call
- [ ] No `sleep` — GA4 rate limiting is token-based, not req/second
- [ ] `returnPropertyQuota: true` on every `runReport` call
- [ ] Quota warning logged when `tokensPerDay.remaining < 1000`

### Transformers
- [ ] Every transformer has an explicit `: *Input` return type — never inferred
- [ ] `parseGa4Date` converts `YYYYMMDD` → `Date` correctly (month is 1-based)
- [ ] `"(not set)"` stored as-is — never converted to `null`
- [ ] Revenue fields use `parseFloat`, count fields use `parseInt(..., 10)`

### Schema
- [ ] No `srcCreatedAt`/`srcModifiedAt` on GA4 tables — analytics tables omit `src_*` columns
- [ ] Composite `@@unique` on each table covers all dimension columns
- [ ] Revenue columns: `Decimal @db.Decimal(12, 2)` — never `Float`
- [ ] Count columns: `Int` — never `Decimal`
- [ ] `reportDate` column: `DateTime @db.DateTime(3)` — never `@db.Date`
- [ ] `propertyId`: `String @db.VarChar(50)` — never `Int`

### Worker
- [ ] All local variables are `camelCase`
- [ ] `logQueued` + `logRunning` called before `try` block
- [ ] `setLastSyncedAt` called before `logSuccess`
- [ ] `default` case throws — unknown job names fail loudly

### Scheduler + Wiring
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Worker imported in `index.ts`
- [ ] Queue added to Bull Board in `app.ts`
- [ ] Scheduler entry uses `GA4_JOBS.DAILY` — no string literals
- [ ] Scheduler entry was commented out until worker was complete

---

## Verification Queries

```sql
-- After first run
SELECT platform, job_type, status, records_fetched, records_saved, duration_ms
FROM sync_logs ORDER BY created_at DESC LIMIT 10;

SELECT COUNT(*) FROM ga4_sessions;
SELECT COUNT(*) FROM ga4_ecommerce_events;
SELECT COUNT(*) FROM ga4_product_data;

-- Verify "(not set)" preserved as-is
SELECT DISTINCT source FROM ga4_sessions WHERE source = '(not set)' LIMIT 1;

-- Verify date stored as DATETIME(3), not string
SELECT report_date, source, sessions FROM ga4_sessions ORDER BY report_date DESC LIMIT 5;

-- Verify property ID stored correctly
SELECT DISTINCT property_id FROM ga4_sessions;

-- Verify sync_config updated
SELECT platform, job_type, last_synced_at FROM sync_config WHERE platform = 'ga4';

-- Empty product data is expected if GA4 ecommerce not configured
SELECT COUNT(*) FROM ga4_product_data;
```
