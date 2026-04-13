# Phase 4 — Klaviyo Integration
**Status:** ⬜ Pending  
**Depends on:** Phase 1 complete  

---

## Goal

Klaviyo data syncing:
- Campaign metadata + performance stats (two separate API calls)
- Subscriber profiles, behavioural events, automated flows
- JSON:API response format handled correctly (`data[].attributes`)
- Event volume controlled by `KLAVIYO_SYNC_EVENT_TYPES` env var
- `revision: 2026-01-15` header on every request

---

## Files to Create (in order)

```
src/constants/klaviyo.ts                          ← already exists, add KLAVIYO_API_REVISION
src/config/index.ts                               ← add KLAVIYO_SYNC_EVENT_TYPES
src/types/klaviyo.types.ts
prisma/schema.prisma                              ← add 5 Klaviyo models, run migration
src/db/repositories/klaviyoRepo.ts                ← *Input interfaces first, upserts after Step 3
src/adapters/klaviyo/klaviyoClient.ts
src/adapters/klaviyo/campaigns.ts
src/adapters/klaviyo/campaignStats.ts
src/adapters/klaviyo/profiles.ts
src/adapters/klaviyo/events.ts
src/adapters/klaviyo/flows.ts
src/transform/klaviyo/campaignTransformer.ts
src/transform/klaviyo/campaignStatTransformer.ts
src/transform/klaviyo/profileTransformer.ts
src/transform/klaviyo/eventTransformer.ts
src/transform/klaviyo/flowTransformer.ts
src/workers/klaviyoWorker.ts
```

> **Schema-first rule:** Add Klaviyo models to `prisma/schema.prisma` and run `npx prisma migrate dev --name add_klaviyo_tables` **before** writing any repo interfaces, transformers, or worker code. The migration is the gate.

---

## Step-by-Step Build

### Step 0 — Authentication Setup

Klaviyo uses a **Private API Key — static credential, never expires, no refresh needed**.

**Required env variables:**
```
KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KLAVIYO_CONVERSION_METRIC_ID=xxxxxxxx
KLAVIYO_SYNC_EVENT_TYPES=Placed Order,Viewed Product,Added to Cart
```

**Where to get:**
1. Log in at https://www.klaviyo.com
2. Settings → API Keys → Create Private API Key
3. Select **Full Access**
4. **Copy immediately** — it will not be shown again
5. `KLAVIYO_CONVERSION_METRIC_ID` → Analytics → Metrics → select your purchase/conversion metric → copy the ID from the URL

---

### Step 1 — Constants

**File:** `src/constants/klaviyo.ts`

Add `KLAVIYO_API_REVISION` to the existing file:

```ts
export const KLAVIYO_PLATFORM     = 'klaviyo';
export const KLAVIYO_QUEUE        = 'klaviyo';
export const KLAVIYO_BASE_URL     = 'https://a.klaviyo.com/api';
export const KLAVIYO_API_REVISION = '2026-01-15';

export const KLAVIYO_JOBS = {
  CAMPAIGNS: 'klaviyo:campaigns',
  PROFILES:  'klaviyo:profiles',
  EVENTS:    'klaviyo:events',
  FLOWS:     'klaviyo:flows',
} as const;
```

Also add to `src/config/index.ts` (inside the `envSchema` object):
```ts
KLAVIYO_SYNC_EVENT_TYPES: z.string().optional(),
```

---

### Step 2 — TypeScript Types

**File:** `src/types/klaviyo.types.ts`

JSON:API structure — all data nested under `data[].attributes`. Follow project rules:
- All fields `Type | null` by default
- All dates as `string`
- No imports, no logic

```ts
// JSON:API wrapper
export interface KlaviyoApiResponse<T> {
  data: Array<{ id: string; type: string; attributes: T }>;
  links: { next: string | null; prev: string | null };
}

export interface KlaviyoCampaignAttributes {
  name: string | null;
  status: string | null;
  channel: string | null;
  send_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  audiences: unknown | null;
  send_options: unknown | null;
}
export interface KlaviyoCampaign {
  id: string; type: string; attributes: KlaviyoCampaignAttributes;
}

export interface KlaviyoCampaignStatResult {
  campaign_id: string | null;
  delivered: number | null;
  opens: number | null;
  opens_unique: number | null;
  open_rate: number | null;
  clicks: number | null;
  clicks_unique: number | null;
  click_rate: number | null;
  unsubscribes: number | null;
  bounces: number | null;
  conversions: number | null;
  conversion_rate: number | null;
  conversion_value: number | null;
  revenue_per_recipient: number | null;
}

export interface KlaviyoProfileAttributes {
  email: string | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
  subscriptions: {
    email: { marketing: { consent: string | null } } | null;
    sms: { marketing: { consent: string | null } } | null;
  } | null;
  location: {
    country: string | null; city: string | null;
    region: string | null; zip: string | null; timezone: string | null;
  } | null;
  properties: {
    lifecycle_stage?: string | null;
    signup_source?: string | null;
    [key: string]: unknown;
  } | null;
  created: string | null;
  updated: string | null;
}
export interface KlaviyoProfile {
  id: string; type: string; attributes: KlaviyoProfileAttributes;
}

export interface KlaviyoEventAttributes {
  metric_id: string | null;
  profile_id: string | null;
  value: number | null;
  datetime: string | null;
  properties: Record<string, unknown> | null;
}
export interface KlaviyoEvent {
  id: string; type: string; attributes: KlaviyoEventAttributes;
}

export interface KlaviyoFlowAttributes {
  name: string | null;
  status: string | null;
  archived: boolean | null;
  trigger_type: string | null;
  created: string | null;
  updated: string | null;
}
export interface KlaviyoFlow {
  id: string; type: string; attributes: KlaviyoFlowAttributes;
}
```

---

### Step 3 — Schema + Migration (gate)

Add all 5 Klaviyo models to `prisma/schema.prisma` following existing conventions:
- `klaviyo_id` → `String @unique @db.VarChar(50)` (Klaviyo IDs are alphanumeric strings — never `Int`)
- `src_created_at` / `src_modified_at` where API exposes them (`created_at`/`updated_at` on campaigns, profiles, flows)
- `KlaviyoCampaignStat` has no `src_*` columns — stats report has no source timestamps
- `KlaviyoEvent` has no `src_modified_at` — events are immutable; use `event_date` for filtering
- All money fields: `Decimal @db.Decimal(12, 2)` (conversion_value); rates: `Decimal @db.Decimal(8, 4)`
- Every model must have `raw_data Json`, `synced_at DateTime`, `created_at`, `modified_at`

**Models:**

| Model | Table | Unique key | src timestamps |
|---|---|---|---|
| `KlaviyoCampaign` | `klaviyo_campaigns` | `klaviyo_id` | `src_created_at`, `src_modified_at` |
| `KlaviyoCampaignStat` | `klaviyo_campaign_stats` | `klaviyo_id` | none (report data) |
| `KlaviyoProfile` | `klaviyo_profiles` | `klaviyo_id` | `src_created_at`, `src_modified_at` |
| `KlaviyoEvent` | `klaviyo_events` | `klaviyo_id` | none (immutable; filter on `event_date`) |
| `KlaviyoFlow` | `klaviyo_flows` | `klaviyo_id` | `src_created_at`, `src_modified_at` |

Then run:
```bash
npx prisma migrate dev --name add_klaviyo_tables
```

**Do not proceed to Step 4 until the migration has run and all 5 tables exist in the DB.**

---

### Step 4 — Repo Input Interfaces

**File:** `src/db/repositories/klaviyoRepo.ts`

Write `*Input` interfaces derived directly from the Prisma model field names (camelCase). If the field name isn't in `schema.prisma`, it doesn't belong in the interface.

```ts
export interface CampaignInput {
  klaviyoId: string;
  name: string | null;
  status: string | null;
  channel: string | null;
  sendTime: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface CampaignStatInput {
  klaviyoId: string;
  delivered: number | null;
  opens: number | null;
  opensUnique: number | null;
  openRate: number | null;
  clicks: number | null;
  clicksUnique: number | null;
  clickRate: number | null;
  unsubscribes: number | null;
  bounces: number | null;
  conversions: number | null;
  conversionRate: number | null;
  conversionValue: number | null;
  revenuePerRecipient: number | null;
  syncedAt: Date;
}

export interface ProfileInput {
  klaviyoId: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  emailConsent: string | null;
  smsConsent: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  zip: string | null;
  timezone: string | null;
  lifecycleStage: string | null;
  signupSource: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface EventInput {
  klaviyoId: string;
  metricId: string | null;
  profileId: string | null;
  value: number | null;
  eventDate: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface FlowInput {
  klaviyoId: string;
  name: string | null;
  status: string | null;
  archived: boolean;
  triggerType: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}
```

---

### Step 5 — Transformers

**Directory:** `src/transform/klaviyo/`

One file per resource. Every transformer **must** declare an explicit return type — TypeScript enforces the contract at compile time.

**`campaignTransformer.ts`:**
```ts
import { KlaviyoCampaign } from '../../types/klaviyo.types';
import { CampaignInput } from '../../db/repositories/klaviyoRepo';

export function transformCampaign(raw: KlaviyoCampaign, syncedAt: Date): CampaignInput {
  return {
    klaviyoId:     raw.id,
    name:          raw.attributes.name ?? null,
    status:        raw.attributes.status ?? null,
    channel:       raw.attributes.channel ?? null,
    sendTime:      raw.attributes.send_time ? new Date(raw.attributes.send_time) : null,
    srcCreatedAt:  raw.attributes.created_at ? new Date(raw.attributes.created_at) : null,
    srcModifiedAt: raw.attributes.updated_at ? new Date(raw.attributes.updated_at) : null,
    rawData:       raw,
    syncedAt,
  };
}
```

**`campaignStatTransformer.ts`:**
```ts
import { KlaviyoCampaignStatResult } from '../../types/klaviyo.types';
import { CampaignStatInput } from '../../db/repositories/klaviyoRepo';

export function transformCampaignStat(raw: KlaviyoCampaignStatResult, syncedAt: Date): CampaignStatInput {
  return {
    klaviyoId:          raw.campaign_id ?? '',
    delivered:          raw.delivered ?? null,
    opens:              raw.opens ?? null,
    opensUnique:        raw.opens_unique ?? null,
    openRate:           raw.open_rate ?? null,
    clicks:             raw.clicks ?? null,
    clicksUnique:       raw.clicks_unique ?? null,
    clickRate:          raw.click_rate ?? null,
    unsubscribes:       raw.unsubscribes ?? null,
    bounces:            raw.bounces ?? null,
    conversions:        raw.conversions ?? null,
    conversionRate:     raw.conversion_rate ?? null,
    conversionValue:    raw.conversion_value ?? null,
    revenuePerRecipient: raw.revenue_per_recipient ?? null,
    syncedAt,
  };
}
```

**`profileTransformer.ts`:**
```ts
import { KlaviyoProfile } from '../../types/klaviyo.types';
import { ProfileInput } from '../../db/repositories/klaviyoRepo';

export function transformProfile(raw: KlaviyoProfile, syncedAt: Date): ProfileInput {
  return {
    klaviyoId:      raw.id,
    email:          raw.attributes.email ?? null,
    phoneNumber:    raw.attributes.phone_number ?? null,
    firstName:      raw.attributes.first_name ?? null,
    lastName:       raw.attributes.last_name ?? null,
    emailConsent:   raw.attributes.subscriptions?.email?.marketing?.consent ?? null,
    smsConsent:     raw.attributes.subscriptions?.sms?.marketing?.consent ?? null,
    country:        raw.attributes.location?.country ?? null,
    city:           raw.attributes.location?.city ?? null,
    region:         raw.attributes.location?.region ?? null,
    zip:            raw.attributes.location?.zip ?? null,
    timezone:       raw.attributes.location?.timezone ?? null,
    lifecycleStage: raw.attributes.properties?.lifecycle_stage ?? null,
    signupSource:   raw.attributes.properties?.signup_source ?? null,
    srcCreatedAt:   raw.attributes.created ? new Date(raw.attributes.created) : null,
    srcModifiedAt:  raw.attributes.updated ? new Date(raw.attributes.updated) : null,
    rawData:        raw,
    syncedAt,
  };
}
```

Same explicit return type pattern for `eventTransformer.ts` and `flowTransformer.ts`.

---

### Step 6 — Adapters + API Client

#### `src/adapters/klaviyo/klaviyoClient.ts`

```ts
import axios from 'axios';
import { config } from '../../config';
import { KLAVIYO_PLATFORM, KLAVIYO_BASE_URL, KLAVIYO_API_REVISION } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

export const klaviyoClient = axios.create({
  baseURL: KLAVIYO_BASE_URL,
  headers: {
    Authorization: `Klaviyo-API-Key ${config.KLAVIYO_API_KEY}`,
    revision: KLAVIYO_API_REVISION,
    'Content-Type': 'application/json',
  },
});

// On 429: read Retry-After header, sleep exact duration, retry once
klaviyoClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: { status?: number; headers?: Record<string, string> }; config?: object };
    if (axiosError.response?.status === 429) {
      const retryAfter = parseInt(axiosError.response.headers?.['retry-after'] ?? '5', 10);
      logger.warn({ platform: KLAVIYO_PLATFORM, retryAfter }, '429 received — waiting before retry');
      await sleep(retryAfter * 1000);
      return klaviyoClient.request(axiosError.config ?? {});
    }
    throw error;
  },
);
```

#### Adapters — Cursor Pagination Pattern

All adapters use `links.next` for pagination. Use the full URL directly — do not re-parse cursor:

```ts
let nextUrl: string | null = null;
do {
  const response = nextUrl
    ? await klaviyoClient.get(nextUrl)
    : await klaviyoClient.get('/endpoint', { params });
  results.push(...response.data.data);
  nextUrl = response.data.links?.next ?? null;
} while (nextUrl);
```

**`campaigns.ts`** — filter on `equals(messages.channel,'email')`, delta on `updated_at`, `page[size]: '50'`

**`campaignStats.ts`** — POST to `/campaign-values-reports/`, no pagination, uses `config.KLAVIYO_CONVERSION_METRIC_ID`

**`profiles.ts`** — delta filter on `updated_at`, `page[size]: '100'`

**`events.ts`** — filter by `KLAVIYO_SYNC_EVENT_TYPES` from config (comma-separated, split + trim), delta filter on `datetime`, `page[size]: '100'`

**`flows.ts`** — delta filter on `updated_at`, `page[size]: '50'`

All adapters:
- Import `sleep` from `'../../utils/sleep'` and `KLAVIYO_PLATFORM` from constants
- Log fetched count via `logger.info` with `platform` and `module` fields
- No fixed `sleep()` between pages — 429 handling is in the client interceptor

---

### Step 7 — Repository Upsert Functions

Add `upsert*` functions to `src/db/repositories/klaviyoRepo.ts` after all `*Input` interfaces are defined.

Standard pattern (same as `cin7Repo.ts`):
- `import { chunk } from '../../utils/chunk'` — chunk size 200
- `import { Prisma } from '@prisma/client'` + `import prisma from '../prismaClient'`
- `Prisma.sql` + `Prisma.join` — never string concatenation
- `ON DUPLICATE KEY UPDATE` on `klaviyo_id` (natural unique key)
- Return `Promise<number>` (total rows saved)

Functions to implement:
- `upsertCampaigns(rows: CampaignInput[]): Promise<number>` → `klaviyo_campaigns`
- `upsertCampaignStats(rows: CampaignStatInput[]): Promise<number>` → `klaviyo_campaign_stats` (always overwrite — stats are cumulative)
- `upsertProfiles(rows: ProfileInput[]): Promise<number>` → `klaviyo_profiles`
- `upsertEvents(rows: EventInput[]): Promise<number>` → `klaviyo_events`
- `upsertFlows(rows: FlowInput[]): Promise<number>` → `klaviyo_flows`

SQL column names in the `INSERT` must match the `@map` values in `schema.prisma` exactly.

---

### Step 8 — Worker

**File:** `src/workers/klaviyoWorker.ts`

Follow the exact same structure as `cin7Worker.ts`:
- Import queue/job names from `src/constants/klaviyo.ts`
- `logQueued` + `logRunning` called **before** the `try` block
- `setLastSyncedAt` called **before** `logSuccess` in every case
- `default` throws — unknown job names fail loudly
- All local variables `camelCase`

```ts
export const klaviyoWorker = new Worker(
  KLAVIYO_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: KLAVIYO_PLATFORM, job: job.name }, 'job started');
    const queuedId = await logQueued(KLAVIYO_PLATFORM, job.name);
    const syncLog  = await logRunning(queuedId);

    try {
      const lastSyncedAt = await getLastSyncedAt(KLAVIYO_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case KLAVIYO_JOBS.CAMPAIGNS: {
          const raw   = await fetchCampaigns(lastSyncedAt);
          const stats = await fetchCampaignStats();
          const campaigns     = raw.map((r) => transformCampaign(r, syncedAt));
          const campaignStats = stats.map((r) => transformCampaignStat(r, syncedAt));
          const recordsSaved  = await upsertCampaigns(campaigns);
          await upsertCampaignStats(campaignStats);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }
        case KLAVIYO_JOBS.PROFILES: { ... }
        case KLAVIYO_JOBS.EVENTS:   { ... }
        case KLAVIYO_JOBS.FLOWS:    { ... }
        default:
          throw new Error(`klaviyoWorker: unknown job name: ${job.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logFailure(syncLog.id, { errorMessage, durationMs: Date.now() - startedAt });
      throw error;
    }
  },
  { connection, concurrency: 2, limiter: { max: 3, duration: 1000 } },
);
```

Register in `index.ts` as a side-effect import (only after worker case and `tsc --noEmit` passes):
```ts
import './src/workers/klaviyoWorker';
```

---

### Step 9 — Scheduler + Wiring

Uncomment Klaviyo entries in `src/queue/scheduler.ts` (already drafted):
```ts
klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGNS, {}, { repeat: { pattern: '0 5 * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.PROFILES,  {}, { repeat: { pattern: '0 */6 * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.EVENTS,    {}, { repeat: { pattern: '40 * * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.FLOWS,     {}, { repeat: { pattern: '5 5 * * *' } }),
```

`klaviyoQueue` is already imported in `src/queue/queues.ts` and `src/server/app.ts` (Bull Board) — no changes needed to those files.

---

## API Rate Limits & Pagination

### Rate Limits

| Limit | Value | Enforcement |
|---|---|---|
| Steady-state limit | ~75 req/10s (private key tier) | BullMQ worker limiter: `{ max: 3, duration: 1000 }` |
| 429 handling | Read `Retry-After` header, sleep exact duration, retry once | Implemented in `klaviyoClient.ts` interceptor |
| Hard retry fallback | BullMQ 3-attempt exponential backoff | Kicks in if single retry also 429s |

**`revision` header:** Must be `2026-01-15` on every request. Wrong/missing revision returns `400`, not `401`. Set once in `KLAVIYO_API_REVISION` constant — never hardcode in adapters.

### Pagination

| Field | Value |
|---|---|
| `links.next` | full URL or `null` — `null` = last page |
| `page[size]` | `50` for campaigns and flows |
| `page[size]` | `100` for profiles and events |
| Terminal condition | `links.next === null` |
| No pagination | `campaignStats.ts` — single POST response |

---

## Pre-Ship Verification Checklist

### Types
- [ ] Every money/price field is `Type | null` — null guard in transformer before use
- [ ] Every nested object field is `Type | null`
- [ ] All dates are `string` in API types, `Date` after transformer

### Adapters
- [ ] Client created once per fetch call
- [ ] No fixed `sleep()` between pages — rate limiting handled by 429 interceptor
- [ ] `KLAVIYO_SYNC_EVENT_TYPES` split from config, not hardcoded

### Transformers
- [ ] Every transformer has explicit `: *Input` return type
- [ ] All `?? null` guards on nullable fields
- [ ] Date strings converted with `new Date(value)`

### Worker
- [ ] All local variables `camelCase`
- [ ] `logQueued` + `logRunning` before `try` block
- [ ] `setLastSyncedAt` before `logSuccess` in every case
- [ ] `default` case throws

### Scheduler + Wiring
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Every scheduled job has a `case` in the worker
- [ ] Worker imported in `index.ts`
- [ ] Scheduler entries use `KLAVIYO_JOBS.*` constants — no string literals

---

## Verification Queries

```sql
SELECT COUNT(*) FROM klaviyo_campaigns;
SELECT COUNT(*) FROM klaviyo_campaign_stats;
SELECT COUNT(*) FROM klaviyo_profiles;
SELECT COUNT(*) FROM klaviyo_events;
SELECT COUNT(*) FROM klaviyo_flows;

-- Verify stats link to campaigns
SELECT c.name, s.open_rate, s.click_rate, s.conversion_value
FROM klaviyo_campaigns c
JOIN klaviyo_campaign_stats s ON c.klaviyo_id = s.klaviyo_id
LIMIT 5;

-- Verify event type filtering
SELECT DISTINCT metric_id FROM klaviyo_events;

-- Check sync_config
SELECT platform, job_type, last_synced_at FROM sync_config WHERE platform = 'klaviyo';

-- Check sync_logs
SELECT platform, job_type, status, records_fetched, records_saved, duration_ms
FROM sync_logs WHERE platform = 'klaviyo' ORDER BY created_at DESC LIMIT 10;
```

---

## Done Criteria

- [ ] All 5 Klaviyo tables populated after first sync
- [ ] `sync_logs` shows `status='success'` for all 4 job types
- [ ] `sync_config.last_synced_at` updated for all Klaviyo job types
- [ ] Campaign stats linked to campaign records via `klaviyo_id`
- [ ] Event volume controlled — only configured event types synced
- [ ] `revision: 2026-01-15` header sent on every request
- [ ] 429 handling: waits `Retry-After` duration, retries once
- [ ] Delta sync working for campaigns, profiles, events, and flows
- [ ] Failed sync does NOT update `last_synced_at`
- [ ] All transformers have explicit `: *Input` return types
- [ ] No inline `sleep` — imported from `src/utils/sleep`
- [ ] No hardcoded platform/job strings — all from `src/constants/klaviyo.ts`
