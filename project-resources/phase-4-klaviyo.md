# Phase 4 — Klaviyo Integration
**Status:** ✅ Complete  
**Depends on:** Phase 1 complete  

---

## Goal

Klaviyo data syncing:
- Campaign metadata + performance stats (two separate API calls)
- Subscriber profiles, behavioural events, automated flows
- JSON:API response format handled correctly (`data[].attributes` + `data[].relationships`)
- Event volume controlled by `KLAVIYO_SYNC_EVENT_TYPES` env var
- `revision: 2026-01-15` header on every request

---

## Files Created

```
src/constants/klaviyo.ts
src/config/index.ts                               ← KLAVIYO_API_KEY, KLAVIYO_SYNC_EVENT_TYPES added
src/types/klaviyo.types.ts
prisma/schema.prisma                              ← 5 Klaviyo models added, migration run
src/db/repositories/klaviyoRepo.ts
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

## Step 0 — Authentication Setup

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

## Step 1 — Constants

**File:** `src/constants/klaviyo.ts`

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
KLAVIYO_API_KEY: z.string().optional(),
KLAVIYO_CONVERSION_METRIC_ID: z.string().optional(),
KLAVIYO_SYNC_EVENT_TYPES: z.string().optional(),
```

---

## Step 2 — TypeScript Types

**File:** `src/types/klaviyo.types.ts`

> **CRITICAL — Klaviyo JSON:API structure:**
> - Regular resource fields live in `data[].attributes`
> - Foreign IDs (metric, profile, etc.) live in `data[].relationships`, NOT in `data[].attributes`
> - Always verify field location against the actual API response before writing types
> - Wrong field path results in silent `null` for every row — no error, no warning

```ts
// JSON:API wrapper
export interface KlaviyoApiResponse<T> {
  data: Array<{ id: string; type: string; attributes: T }>;
  links: { next: string | null; prev: string | null };
}

// Campaign

export interface KlaviyoCampaignAttributes {
  name: string | null;
  status: string | null;
  channel: string | null;           // NOTE: field is 'channel', NOT 'messages.channel'
  send_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  audiences: unknown | null;
  send_options: unknown | null;
}

export interface KlaviyoCampaign {
  id: string;
  type: string;
  attributes: KlaviyoCampaignAttributes;
}

// Campaign Stats
// NOTE: campaign-values-reports returns a flat result array — NOT a JSON:API envelope.
// campaign_id here is a top-level field, not data[].id. This is intentional.

export interface KlaviyoCampaignStatResult {
  campaign_id: string | null;   // NEVER default to '' — throw if null (see transformer)
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

// Profile

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
    country: string | null;
    city: string | null;
    region: string | null;
    zip: string | null;
    timezone: string | null;
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
  id: string;
  type: string;
  attributes: KlaviyoProfileAttributes;
}

// Event
// NOTE: metric_id and profile_id are in RELATIONSHIPS, not attributes.
// Per Klaviyo JSON:API spec: foreign IDs live in data[].relationships.
// Reading them from attributes will always return null.

export interface KlaviyoEventAttributes {
  value: number | null;
  datetime: string | null;
  properties: Record<string, unknown> | null;
}

export interface KlaviyoEventRelationships {
  metric:  { data: { id: string; type: string } | null } | null;
  profile: { data: { id: string; type: string } | null } | null;
}

export interface KlaviyoEvent {
  id: string;
  type: string;
  attributes: KlaviyoEventAttributes;
  relationships: KlaviyoEventRelationships | null;
}

// Flow

export interface KlaviyoFlowAttributes {
  name: string | null;
  status: string | null;
  archived: boolean | null;
  trigger_type: string | null;
  created: string | null;
  updated: string | null;
}

export interface KlaviyoFlow {
  id: string;
  type: string;
  attributes: KlaviyoFlowAttributes;
}
```

---

## Step 3 — Schema + Migration (gate)

Add all 5 Klaviyo models to `prisma/schema.prisma` following existing conventions:
- `klaviyo_id` → `String @unique @db.VarChar(50)` (Klaviyo IDs are alphanumeric strings — never `Int`)
- `src_created_at` / `src_modified_at` where API exposes them
- `KlaviyoCampaignStat` has no `src_*` columns — stats report has no source timestamps
- `KlaviyoEvent` has no `src_modified_at` — events are immutable; filter on `event_date`
- All money fields: `Decimal @db.Decimal(12, 2)`; rates: `Decimal @db.Decimal(8, 4)`
- Every model must have `raw_data Json`, `synced_at DateTime`, `created_at`, `modified_at`

**Models:**

| Model | Table | Unique key | src timestamps | Required indexes |
|---|---|---|---|---|
| `KlaviyoCampaign` | `klaviyo_campaigns` | `klaviyo_id` | `src_created_at`, `src_modified_at` | `src_modified_at`, `synced_at` |
| `KlaviyoCampaignStat` | `klaviyo_campaign_stats` | `klaviyo_id` | none (report data) | `synced_at` |
| `KlaviyoProfile` | `klaviyo_profiles` | `klaviyo_id` | `src_created_at`, `src_modified_at` | `src_modified_at`, `synced_at` |
| `KlaviyoEvent` | `klaviyo_events` | `klaviyo_id` | none (immutable) | **`event_date`**, `synced_at` |
| `KlaviyoFlow` | `klaviyo_flows` | `klaviyo_id` | `src_created_at`, `src_modified_at` | `src_modified_at`, `synced_at` |

> **`KlaviyoEvent` index note:** `event_date` is the incremental sync key for events (not `src_modified_at`). Index it explicitly: `@@index([eventDate], map: "idx_klaviyo_events_event_date")`.

Then run:
```bash
npx prisma migrate dev --name add_klaviyo_tables
```

**Do not proceed to Step 4 until the migration has run and all 5 tables exist in the DB.**

After adding the `event_date` index later:
```bash
npx prisma migrate dev --name add_klaviyo_event_date_index
```

---

## Step 4 — Repo Input Interfaces

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
  klaviyoId: string;       // MUST be non-empty — transformer throws if campaign_id is null
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
  rawData: object;
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
  metricId: string | null;    // from relationships.metric.data.id
  profileId: string | null;   // from relationships.profile.data.id
  value: number | null;
  eventDate: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface FlowInput {
  klaviyoId: string;
  name: string | null;
  status: string | null;
  archived: boolean | null;
  triggerType: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}
```

---

## Step 5 — Transformers

**Directory:** `src/transform/klaviyo/`

Every transformer **must** declare an explicit return type — TypeScript enforces the contract at compile time.

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
  // campaign_id is the natural unique key — a null here means corrupt API data.
  // Never default to '' — that writes a bogus record that blocks all future upserts.
  if (!raw.campaign_id) {
    throw new Error('transformCampaignStat: missing campaign_id in API response');
  }

  return {
    klaviyoId:           raw.campaign_id,
    delivered:           raw.delivered ?? null,
    opens:               raw.opens ?? null,
    opensUnique:         raw.opens_unique ?? null,
    openRate:            raw.open_rate ?? null,
    clicks:              raw.clicks ?? null,
    clicksUnique:        raw.clicks_unique ?? null,
    clickRate:           raw.click_rate ?? null,
    unsubscribes:        raw.unsubscribes ?? null,
    bounces:             raw.bounces ?? null,
    conversions:         raw.conversions ?? null,
    conversionRate:      raw.conversion_rate ?? null,
    conversionValue:     raw.conversion_value ?? null,
    revenuePerRecipient: raw.revenue_per_recipient ?? null,
    rawData:             raw,
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

**`eventTransformer.ts`:**
```ts
import { KlaviyoEvent } from '../../types/klaviyo.types';
import { EventInput } from '../../db/repositories/klaviyoRepo';

export function transformEvent(raw: KlaviyoEvent, syncedAt: Date): EventInput {
  return {
    klaviyoId: raw.id,
    // metric_id and profile_id come from relationships, NOT attributes
    metricId:  raw.relationships?.metric?.data?.id  ?? null,
    profileId: raw.relationships?.profile?.data?.id ?? null,
    value:     raw.attributes.value ?? null,
    eventDate: raw.attributes.datetime ? new Date(raw.attributes.datetime) : null,
    rawData:   raw,
    syncedAt,
  };
}
```

**`flowTransformer.ts`:**
```ts
import { KlaviyoFlow } from '../../types/klaviyo.types';
import { FlowInput } from '../../db/repositories/klaviyoRepo';

export function transformFlow(raw: KlaviyoFlow, syncedAt: Date): FlowInput {
  return {
    klaviyoId:     raw.id,
    name:          raw.attributes.name ?? null,
    status:        raw.attributes.status ?? null,
    archived:      raw.attributes.archived ?? null,
    triggerType:   raw.attributes.trigger_type ?? null,
    srcCreatedAt:  raw.attributes.created ? new Date(raw.attributes.created) : null,
    srcModifiedAt: raw.attributes.updated ? new Date(raw.attributes.updated) : null,
    rawData:       raw,
    syncedAt,
  };
}
```

---

## Step 6 — Adapters + API Client

### `src/adapters/klaviyo/klaviyoClient.ts`

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

// 429: read Retry-After header, sleep exact duration, retry ONCE.
// Cap at 1 interceptor-level retry — consecutive 429s fall through to BullMQ backoff.
// 401: log clearly before rethrow — silent 401 loops waste all 3 BullMQ attempts.
klaviyoClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const status = error.response?.status;

    if (status === 429) {
      const cfg = error.config as unknown as Record<string, unknown>;
      const retryCount = typeof cfg.__retryCount === 'number' ? cfg.__retryCount : 0;

      if (retryCount >= 1) {
        throw error;  // let BullMQ exponential backoff handle it
      }

      const retryAfter = parseInt(error.response?.headers?.['retry-after'] ?? '5', 10);
      logger.warn({ platform: KLAVIYO_PLATFORM, retryAfter }, '429 received — retrying');

      cfg.__retryCount = retryCount + 1;
      await sleep(retryAfter * 1000);
      return klaviyoClient.request(error.config!);
    }

    if (status === 401) {
      logger.error({ platform: KLAVIYO_PLATFORM, status: 401 }, 'Klaviyo auth failed — check KLAVIYO_API_KEY');
    }

    throw error;
  },
);
```

### Adapters — Cursor Pagination (IMPORTANT)

> **CRITICAL — `next` URL format:**
> Klaviyo's `links.next` is a **full URL** (e.g. `https://a.klaviyo.com/api/campaigns?page[cursor]=xxx`).
> Passing a full URL to an axios instance that already has `baseURL` set will **double the base URL**
> and produce a `404` or `ECONNREFUSED` on every page after page 1.
>
> **Always extract path+query before passing to the client:**
> ```ts
> function toRelativePath(fullUrl: string): string {
>   const parsed = new URL(fullUrl);
>   return parsed.pathname + parsed.search;
> }
> ```
> Put `toRelativePath` in each adapter file — not shared — to keep each adapter self-contained.

**Correct pagination pattern:**
```ts
import { URL } from 'url';

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  return parsed.pathname + parsed.search;
}

let nextUrl: string | null = null;
do {
  const response = await getPage(
    nextUrl ? toRelativePath(nextUrl) : '/endpoint',
    nextUrl ? undefined : params,
  );
  results.push(...response.data.data);
  nextUrl = response.data.links?.next ?? null;
} while (nextUrl);
```

### Adapter details

**`campaigns.ts`** — filter on `equals(channel,'email')` (**not** `messages.channel`), delta on `updated_at`, `page[size]: 50`

**`campaignStats.ts`** — POST to `/campaign-values-reports/`, no pagination.
- Chunk `campaignIds` in batches of **100** — Klaviyo silently truncates or errors above that:
  ```ts
  for (const batch of chunk(campaignIds, 100)) {
    const response = await klaviyoClient.post('/campaign-values-reports/', { ... batch ... });
    allResults.push(...(response.data.results ?? []));
  }
  ```
- `conversion_metric_id` can be `null` — Klaviyo uses its default conversion metric when omitted

**`profiles.ts`** — delta filter on `updated`, `page[size]: 100`

**`events.ts`** — filter by `KLAVIYO_SYNC_EVENT_TYPES` from config (comma-separated, split + trim), delta filter on `datetime`, `page[size]: 100`

**`flows.ts`** — delta filter on `updated`, `page[size]: 50`

All adapters:
- Import `URL` from `'url'` for `toRelativePath`
- Import `chunk` from `'../../utils/chunk'` where batching is needed (campaignStats)
- Log fetched count via `logger.info` with `platform` and `module` fields
- No fixed `sleep()` between pages — 429 handling is entirely in the client interceptor

---

## Step 7 — Repository Upsert Functions

Add `upsert*` functions to `src/db/repositories/klaviyoRepo.ts` after all `*Input` interfaces are defined.

Standard pattern:
- `import { chunk } from '../../utils/chunk'` — chunk size 200
- `import { Prisma } from '@prisma/client'` + `import prisma from '../prismaClient'`
- `Prisma.sql` + `Prisma.join` — never string concatenation
- `ON DUPLICATE KEY UPDATE` on `klaviyo_id` (natural unique key)
- Return `Promise<number>` (total rows saved)

Functions:
- `upsertCampaigns(rows: CampaignInput[]): Promise<number>` → `klaviyo_campaigns`
- `upsertCampaignStats(rows: CampaignStatInput[]): Promise<number>` → `klaviyo_campaign_stats`
- `upsertProfiles(rows: ProfileInput[]): Promise<number>` → `klaviyo_profiles`
- `upsertEvents(rows: EventInput[]): Promise<number>` → `klaviyo_events`
- `upsertFlows(rows: FlowInput[]): Promise<number>` → `klaviyo_flows`

---

## Step 8 — Worker

**File:** `src/workers/klaviyoWorker.ts`

Follow the exact same structure as `cin7Worker.ts`:
- Queue/job names from `KLAVIYO_JOBS` constants — no inline strings
- All local variables `camelCase` (TypeScript convention)
- `logQueued` + `logRunning` called **before** the `try` block
- `setLastSyncedAt` called **before** `logSuccess` in every case
- `default` throws — unknown job names fail loudly

> **CAMPAIGNS case — stats date window:**
> Do NOT use `new Date(0)` as the full-sync fallback. Klaviyo rejects or returns empty
> for a timeframe starting in 1970. Use 90 days back as the default:
> ```ts
> const statsStart = lastSyncedAt ?? (() => {
>   const d = new Date(syncedAt);
>   d.setDate(d.getDate() - 90);
>   return d;
> })();
> ```

> **CAMPAIGNS case — record count:**
> Capture both `upsertCampaigns` and `upsertCampaignStats` row counts separately and sum them:
> ```ts
> const campaignsSaved = await upsertCampaigns(campaigns);
> const statsSaved     = await upsertCampaignStats(campaignStats);
> await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
> await logSuccess(syncLog.id, {
>   recordsFetched: rawCampaigns.length,
>   recordsSaved: campaignsSaved + statsSaved,
>   ...
> });
> ```

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
          const rawCampaigns = await fetchCampaigns(lastSyncedAt);
          const campaigns    = rawCampaigns.map((r) => transformCampaign(r, syncedAt));

          const campaignIds = rawCampaigns.map((r) => r.id);
          const now = syncedAt.toISOString();
          const statsStart = lastSyncedAt ?? (() => { const d = new Date(syncedAt); d.setDate(d.getDate() - 90); return d; })();
          const rawStats     = await fetchCampaignStats(campaignIds, statsStart.toISOString(), now);
          const campaignStats = rawStats.map((r) => transformCampaignStat(r, syncedAt));

          const campaignsSaved = await upsertCampaigns(campaigns);
          const statsSaved     = await upsertCampaignStats(campaignStats);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: rawCampaigns.length,
            recordsSaved: campaignsSaved + statsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.PROFILES: {
          const raw = await fetchProfiles(lastSyncedAt);
          const rows = raw.map((r) => transformProfile(r, syncedAt));
          const recordsSaved = await upsertProfiles(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case KLAVIYO_JOBS.EVENTS: {
          const raw = await fetchEvents(lastSyncedAt);
          const rows = raw.map((r) => transformEvent(r, syncedAt));
          const recordsSaved = await upsertEvents(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case KLAVIYO_JOBS.FLOWS: {
          const raw = await fetchFlows(lastSyncedAt);
          const rows = raw.map((r) => transformFlow(r, syncedAt));
          const recordsSaved = await upsertFlows(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

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

Register in `index.ts` (only after worker case and `tsc --noEmit` passes):
```ts
import './src/workers/klaviyoWorker';
```

---

## Step 9 — Scheduler + Wiring

Add to `src/queue/scheduler.ts`:
```ts
import { klaviyoQueue } from './queues';
import { KLAVIYO_JOBS } from '../constants/klaviyo';

// inside registerSchedulers():
klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGNS, {}, { repeat: { pattern: '0 5 * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.PROFILES,  {}, { repeat: { pattern: '0 */6 * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.EVENTS,    {}, { repeat: { pattern: '40 * * * *' } }),
klaviyoQueue.add(KLAVIYO_JOBS.FLOWS,     {}, { repeat: { pattern: '5 5 * * *' } }),
```

`klaviyoQueue` is already exported from `src/queue/queues.ts`.

---

## API Rate Limits & Pagination

### Rate Limits

| Limit | Value | Enforcement |
|---|---|---|
| Steady-state limit | ~75 req/10s (private key tier) | BullMQ worker limiter: `{ max: 3, duration: 1000 }` |
| 429 handling | Read `Retry-After` header, sleep exact duration, retry **once** | Implemented in `klaviyoClient.ts` interceptor |
| Max interceptor retries | **1** | `__retryCount` guard — prevents infinite retry loop |
| Hard retry fallback | BullMQ 3-attempt exponential backoff | Kicks in if single retry also 429s |

**`revision` header:** Must be `2026-01-15` on every request. Wrong/missing revision returns `400`. Set once in `KLAVIYO_API_REVISION` constant — never hardcode in adapters.

### Pagination

| Field | Value |
|---|---|
| `links.next` | **full URL** or `null` — always strip to path+query via `toRelativePath()` before passing to axios |
| `page[size]` | `50` for campaigns and flows |
| `page[size]` | `100` for profiles and events |
| Terminal condition | `links.next === null` |
| No pagination | `campaignStats.ts` — single POST, but chunk `campaignIds` at 100 |

---

## Known Gotchas

| Gotcha | Impact | Fix |
|---|---|---|
| `links.next` is a full URL | Page 2+ hits doubled base URL → 404 | `toRelativePath()` in every adapter |
| `metric_id`/`profile_id` in relationships, not attributes | Always null without fix | Read from `relationships.metric.data.id` |
| Campaign filter field is `channel`, not `messages.channel` | Filter silently ignored or 400 | Use `equals(channel,'email')` |
| Stats date window `new Date(0)` = 1970 | Empty response from API | Use 90-day fallback |
| `campaign_id ?? ''` in stat transformer | Silent unique key corruption | Throw on null |
| campaignStats batch > 100 IDs | Truncated or error | chunk at 100 |
| 429 interceptor without retry cap | Infinite loop, never fails | Cap at 1 retry via `__retryCount` |

---

## Pre-Ship Verification Checklist

### Types
- [ ] Verified field locations against actual API response (not just docs)
- [ ] Foreign IDs confirmed in `relationships`, not `attributes`
- [ ] Every money/price field is `Type | null` — null guard in transformer
- [ ] Every nested object field is `Type | null`
- [ ] All dates are `string` in API types, `Date` after transformer

### Adapters
- [ ] `toRelativePath()` applied in every paginated adapter
- [ ] `next` URL format confirmed (full URL vs relative) before writing adapter
- [ ] `campaignIds` chunked at 100 in `fetchCampaignStats`
- [ ] No fixed `sleep()` between pages — 429 handled by client interceptor
- [ ] `KLAVIYO_SYNC_EVENT_TYPES` split from config, not hardcoded

### Transformers
- [ ] Every transformer has explicit `: *Input` return type — never inferred
- [ ] Natural unique key field (campaign_id, klaviyo_id) throws on null — never `?? ''` or `?? 0`
- [ ] All `?? null` guards on nullable fields
- [ ] Date strings converted with `new Date(value)`
- [ ] `metricId` / `profileId` read from `relationships`, not `attributes`

### Worker
- [ ] All local variables `camelCase`
- [ ] `logQueued` + `logRunning` before `try` block
- [ ] `setLastSyncedAt` before `logSuccess` in every case
- [ ] Stats date window uses 90-day fallback, not `new Date(0)`
- [ ] Both `upsertCampaigns` and `upsertCampaignStats` row counts captured
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

-- Verify events have metric + profile IDs (not null)
SELECT klaviyo_id, metric_id, profile_id FROM klaviyo_events LIMIT 5;

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

- [x] All 5 Klaviyo tables populated after first sync
- [x] `sync_logs` shows `status='success'` for all 4 job types
- [x] `sync_config.last_synced_at` updated for all Klaviyo job types
- [x] Campaign stats linked to campaign records via `klaviyo_id`
- [x] Event `metric_id` and `profile_id` are non-null (read from relationships)
- [x] Event volume controlled — only configured event types synced
- [x] `revision: 2026-01-15` header sent on every request
- [x] 429 handling: waits `Retry-After` duration, retries once, then BullMQ backoff
- [x] Delta sync working for campaigns, profiles, events, and flows
- [x] Failed sync does NOT update `last_synced_at`
- [x] All transformers have explicit `: *Input` return types
- [x] No inline `sleep` — imported from `src/utils/sleep`
- [x] No hardcoded platform/job strings — all from `src/constants/klaviyo.ts`
- [x] `toRelativePath()` applied in all paginated adapters — no doubled base URL
- [x] `campaignIds` chunked at 100 in `fetchCampaignStats`
- [x] `campaignStatTransformer` throws on null `campaign_id` — never writes `''`
