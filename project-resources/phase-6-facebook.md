# Phase 6 — Facebook / Meta Ads Integration
**Status:** Complete
**Depends on:** Phase 1 complete

---

## Goal

Facebook / Meta Marketing API data syncing daily:
- Campaign metadata (name, status, objective)
- Ad Set metadata (name, status, budgets)
- Ad metadata (name, status)
- Campaign-level insights (spend, impressions, clicks, conversions — per day)
- Ad Set-level insights (same metrics per day)
- Ad-level insights (same metrics per day)
- Always syncs **yesterday** (daily cron at 4am)
- 6 API calls/day total (3 metadata + 3 insight levels)

> **CRITICAL — 3 separate insight calls required:** Campaign insights cannot be mixed across levels in a single request. Separate requests must be made for `level=campaign`, `level=adset`, `level=ad`.

---

## Files to Create (in order)

```
src/constants/facebook.ts                         ← Step 1 — do this first
src/types/facebook.types.ts
prisma/schema.prisma                              ← add Facebook models, run migration
src/adapters/facebook/facebookClient.ts
src/adapters/facebook/campaigns.ts
src/adapters/facebook/adsets.ts
src/adapters/facebook/ads.ts
src/adapters/facebook/campaignInsights.ts
src/adapters/facebook/adsetInsights.ts
src/adapters/facebook/adInsights.ts
src/transform/facebook/campaignTransformer.ts
src/transform/facebook/adsetTransformer.ts
src/transform/facebook/adTransformer.ts
src/transform/facebook/campaignInsightTransformer.ts
src/transform/facebook/adsetInsightTransformer.ts
src/transform/facebook/adInsightTransformer.ts
src/db/repositories/facebookRepo.ts
src/workers/facebookWorker.ts
```

> **Schema-first rule:** Add Facebook models to `prisma/schema.prisma` and run the migration **before** writing any repo interfaces, transformers, or worker code. The migration is the gate.
>
> **Always run migrations inside the Docker container:**
> ```bash
> docker exec -it NimbleAPI npx prisma migrate dev --name add_facebook_tables
> sudo chown -R $USER:$USER prisma/migrations/
> ```

---

## Step 0 — Authentication Setup

Facebook uses a **System User token — does not expire**.

**How it works:**
1. Go to [Meta Business Suite](https://business.facebook.com) → Settings → Users → System Users
2. Create a System User with **Admin** role
3. Generate a token with scopes: `ads_read`, `ads_management`
4. System User tokens never expire — store as a static credential
5. On API error code `190` (OAuthException / token invalid): **log FATAL, stop immediately — do not retry**

**Required env variables (add to `src/config/index.ts`):**
```
FACEBOOK_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FACEBOOK_AD_ACCOUNT_ID=1234567890
```

> **Ad account ID:** Store the **numeric ID only** in env. The adapter prepends `act_` in all API calls. Example: `FACEBOOK_AD_ACCOUNT_ID=1234567890` → adapter calls `/act_1234567890/campaigns`.

**No `platform_tokens` DB entry needed** — Facebook is auth-via-env like GA4. No `tokenManager.ts` involvement.

**Install:** No additional packages — uses Node.js `fetch` (native) via the Facebook client.

---

## Step 1 — Constants

**File:** `src/constants/facebook.ts`

```ts
export const FACEBOOK_PLATFORM = 'facebook';
export const FACEBOOK_QUEUE    = 'facebook';
export const FACEBOOK_BASE_URL = 'https://graph.facebook.com/v25.0';

export const FACEBOOK_JOBS = {
  CAMPAIGNS:         'facebook:campaigns',
  ADSETS:            'facebook:adsets',
  ADS:               'facebook:ads',
  CAMPAIGN_INSIGHTS: 'facebook:campaign-insights',
  ADSET_INSIGHTS:    'facebook:adset-insights',
  AD_INSIGHTS:       'facebook:ad-insights',
} as const;
```

---

## Step 2 — TypeScript Types

**File:** `src/types/facebook.types.ts`

All fields `Type | null` by default — only remove `| null` when the Facebook API docs explicitly guarantee the field is always present.

```ts
// ─── Metadata types ────────────────────────────────────────────────────────

export interface FacebookCampaignRaw {
  id:           string | null;
  name:         string | null;
  status:       string | null;
  objective:    string | null;
  created_time: string | null;   // ISO 8601, e.g. "2026-04-14T10:00:00+0000"
  updated_time: string | null;
}

export interface FacebookAdsetRaw {
  id:               string | null;
  name:             string | null;
  campaign_id:      string | null;
  status:           string | null;
  daily_budget:     string | null;    // minor units string, e.g. "5000" = $50.00
  lifetime_budget:  string | null;    // minor units string
  created_time:     string | null;
  updated_time:     string | null;
}

export interface FacebookAdRaw {
  id:           string | null;
  name:         string | null;
  adset_id:     string | null;
  campaign_id:  string | null;
  status:       string | null;
  created_time: string | null;
  updated_time: string | null;
}

// ─── Insights action type (actions / action_values arrays) ─────────────────

export interface FacebookAction {
  action_type: string | null;
  value:       string | null;   // Facebook returns all metric values as strings
}

// ─── Insights types ────────────────────────────────────────────────────────

export interface FacebookCampaignInsightRaw {
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;   // "YYYY-MM-DD"
  spend:         string | null;   // e.g. "12.34" — parseFloat in transformer
  impressions:   string | null;   // parseInt in transformer
  clicks:        string | null;   // parseInt
  reach:         string | null;   // parseInt
  frequency:     string | null;   // parseFloat
  ctr:           string | null;   // parseFloat
  cpc:           string | null;   // parseFloat
  cpm:           string | null;   // parseFloat
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

export interface FacebookAdsetInsightRaw {
  adset_id:      string | null;
  adset_name:    string | null;
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;
  spend:         string | null;
  impressions:   string | null;
  clicks:        string | null;
  reach:         string | null;
  frequency:     string | null;
  ctr:           string | null;
  cpc:           string | null;
  cpm:           string | null;
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

export interface FacebookAdInsightRaw {
  ad_id:         string | null;
  ad_name:       string | null;
  adset_id:      string | null;
  adset_name:    string | null;
  campaign_id:   string | null;
  campaign_name: string | null;
  date_start:    string | null;
  spend:         string | null;
  impressions:   string | null;
  clicks:        string | null;
  reach:         string | null;
  ctr:           string | null;
  cpc:           string | null;
  cpm:           string | null;
  actions:       FacebookAction[] | null;
  action_values: FacebookAction[] | null;
}

// ─── Pagination cursor ─────────────────────────────────────────────────────

export interface FacebookPagingCursors {
  after:  string | null;
  before: string | null;
}

export interface FacebookPaging {
  cursors: FacebookPagingCursors | null;
  next:    string | null;
}

export interface FacebookListResponse<T> {
  data:   T[];
  paging: FacebookPaging | null;
}
```

---

## Step 3 — Schema + Migration (gate)

Add all Facebook models to `prisma/schema.prisma`. Per the rules:
- Facebook has **source timestamps** (`created_time`, `updated_time`) on metadata tables → include `srcCreatedAt` + `srcModifiedAt`
- Insights tables are analytics/reporting tables → **omit `srcCreatedAt`/`srcModifiedAt`** (no source timestamps on insights rows)
- Facebook IDs are numeric strings → `String @db.VarChar(50)` — **never `Int`**
- All timestamps: `DateTime @db.DateTime(3)` — **never `@db.Date`**
- All money fields: `Decimal @db.Decimal(12, 2)`
- Rate metrics (CTR, CPM, CPC, frequency): `Decimal @db.Decimal(8, 4)`
- Count metrics (impressions, reach): `Int` (BigInt if > 2B expected)
- Click metrics: `Int`
- `rawData Json @map("raw_data")` on every table
- Required indexes: `srcModifiedAt` + `syncedAt` on metadata tables; `syncedAt` only on insights tables

```prisma
// ─── Facebook Campaigns (metadata) ────────────────────────────────────────

model FacebookCampaign {
  id            BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  campaignId    String   @unique @map("campaign_id") @db.VarChar(50)
  campaignName  String?  @map("campaign_name") @db.VarChar(255)
  status        String?  @db.VarChar(50)
  objective     String?  @db.VarChar(100)
  rawData       Json     @map("raw_data")
  syncedAt      DateTime @map("synced_at") @db.DateTime(3)
  srcCreatedAt  DateTime @map("src_created_at") @db.DateTime(3)
  srcModifiedAt DateTime @map("src_modified_at") @db.DateTime(3)
  createdAt     DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt    DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@index([srcModifiedAt], map: "idx_facebook_campaigns_src_modified_at")
  @@index([syncedAt],      map: "idx_facebook_campaigns_synced_at")
  @@map("facebook_campaigns")
}

// ─── Facebook Ad Sets (metadata) ──────────────────────────────────────────

model FacebookAdset {
  id             BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  adsetId        String   @unique @map("adset_id") @db.VarChar(50)
  adsetName      String?  @map("adset_name") @db.VarChar(255)
  campaignId     String?  @map("campaign_id") @db.VarChar(50)
  status         String?  @db.VarChar(50)
  dailyBudget    Decimal? @map("daily_budget") @db.Decimal(12, 2)
  lifetimeBudget Decimal? @map("lifetime_budget") @db.Decimal(12, 2)
  rawData        Json     @map("raw_data")
  syncedAt       DateTime @map("synced_at") @db.DateTime(3)
  srcCreatedAt   DateTime @map("src_created_at") @db.DateTime(3)
  srcModifiedAt  DateTime @map("src_modified_at") @db.DateTime(3)
  createdAt      DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt     DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@index([campaignId],    map: "idx_facebook_adsets_campaign_id")
  @@index([srcModifiedAt], map: "idx_facebook_adsets_src_modified_at")
  @@index([syncedAt],      map: "idx_facebook_adsets_synced_at")
  @@map("facebook_adsets")
}

// ─── Facebook Ads (metadata) ───────────────────────────────────────────────

model FacebookAd {
  id            BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  adId          String   @unique @map("ad_id") @db.VarChar(50)
  adName        String?  @map("ad_name") @db.VarChar(255)
  adsetId       String?  @map("adset_id") @db.VarChar(50)
  campaignId    String?  @map("campaign_id") @db.VarChar(50)
  status        String?  @db.VarChar(50)
  rawData       Json     @map("raw_data")
  syncedAt      DateTime @map("synced_at") @db.DateTime(3)
  srcCreatedAt  DateTime @map("src_created_at") @db.DateTime(3)
  srcModifiedAt DateTime @map("src_modified_at") @db.DateTime(3)
  createdAt     DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt    DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@index([adsetId],       map: "idx_facebook_ads_adset_id")
  @@index([campaignId],    map: "idx_facebook_ads_campaign_id")
  @@index([srcModifiedAt], map: "idx_facebook_ads_src_modified_at")
  @@index([syncedAt],      map: "idx_facebook_ads_synced_at")
  @@map("facebook_ads")
}

// ─── Facebook Campaign Insights (analytics — no src_* timestamps) ──────────

model FacebookCampaignInsight {
  id                   BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  campaignId           String   @map("campaign_id") @db.VarChar(50)
  campaignName         String?  @map("campaign_name") @db.VarChar(255)
  reportDate           DateTime @map("report_date") @db.DateTime(3)
  spend                Decimal  @default(0) @db.Decimal(12, 2)
  impressions          Int      @default(0)
  clicks               Int      @default(0)
  reach                Int      @default(0)
  frequency            Decimal? @db.Decimal(8, 4)
  ctr                  Decimal? @db.Decimal(8, 4)
  cpc                  Decimal? @db.Decimal(12, 4)
  cpm                  Decimal? @db.Decimal(12, 4)
  purchases            Int      @default(0)
  addToCarts           Int      @default(0) @map("add_to_carts")
  initiateCheckouts    Int      @default(0) @map("initiate_checkouts")
  landingPageViews     Int      @default(0) @map("landing_page_views")
  conversionsJson      Json?    @map("conversions_json")
  conversionValuesJson Json?    @map("conversion_values_json")
  rawData              Json     @map("raw_data")
  syncedAt             DateTime @map("synced_at") @db.DateTime(3)
  createdAt            DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt           DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([campaignId, reportDate], map: "uq_facebook_campaign_insights_key")
  @@index([reportDate], map: "idx_facebook_campaign_insights_report_date")
  @@index([syncedAt],   map: "idx_facebook_campaign_insights_synced_at")
  @@map("facebook_campaign_insights")
}

// ─── Facebook Ad Set Insights (analytics — no src_* timestamps) ────────────

model FacebookAdsetInsight {
  id                   BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  adsetId              String   @map("adset_id") @db.VarChar(50)
  adsetName            String?  @map("adset_name") @db.VarChar(255)
  campaignId           String?  @map("campaign_id") @db.VarChar(50)
  campaignName         String?  @map("campaign_name") @db.VarChar(255)
  reportDate           DateTime @map("report_date") @db.DateTime(3)
  spend                Decimal  @default(0) @db.Decimal(12, 2)
  impressions          Int      @default(0)
  clicks               Int      @default(0)
  reach                Int      @default(0)
  frequency            Decimal? @db.Decimal(8, 4)
  ctr                  Decimal? @db.Decimal(8, 4)
  cpc                  Decimal? @db.Decimal(12, 4)
  cpm                  Decimal? @db.Decimal(12, 4)
  purchases            Int      @default(0)
  addToCarts           Int      @default(0) @map("add_to_carts")
  initiateCheckouts    Int      @default(0) @map("initiate_checkouts")
  landingPageViews     Int      @default(0) @map("landing_page_views")
  conversionsJson      Json?    @map("conversions_json")
  conversionValuesJson Json?    @map("conversion_values_json")
  rawData              Json     @map("raw_data")
  syncedAt             DateTime @map("synced_at") @db.DateTime(3)
  createdAt            DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt           DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([adsetId, reportDate], map: "uq_facebook_adset_insights_key")
  @@index([campaignId],  map: "idx_facebook_adset_insights_campaign_id")
  @@index([reportDate],  map: "idx_facebook_adset_insights_report_date")
  @@index([syncedAt],    map: "idx_facebook_adset_insights_synced_at")
  @@map("facebook_adset_insights")
}

// ─── Facebook Ad Insights (analytics — no src_* timestamps) ───────────────

model FacebookAdInsight {
  id                   BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  adId                 String   @map("ad_id") @db.VarChar(50)
  adName               String?  @map("ad_name") @db.VarChar(255)
  adsetId              String?  @map("adset_id") @db.VarChar(50)
  adsetName            String?  @map("adset_name") @db.VarChar(255)
  campaignId           String?  @map("campaign_id") @db.VarChar(50)
  campaignName         String?  @map("campaign_name") @db.VarChar(255)
  reportDate           DateTime @map("report_date") @db.DateTime(3)
  spend                Decimal  @default(0) @db.Decimal(12, 2)
  impressions          Int      @default(0)
  clicks               Int      @default(0)
  reach                Int      @default(0)
  ctr                  Decimal? @db.Decimal(8, 4)
  cpc                  Decimal? @db.Decimal(12, 4)
  cpm                  Decimal? @db.Decimal(12, 4)
  purchases            Int      @default(0)
  addToCarts           Int      @default(0) @map("add_to_carts")
  initiateCheckouts    Int      @default(0) @map("initiate_checkouts")
  landingPageViews     Int      @default(0) @map("landing_page_views")
  conversionsJson      Json?    @map("conversions_json")
  conversionValuesJson Json?    @map("conversion_values_json")
  rawData              Json     @map("raw_data")
  syncedAt             DateTime @map("synced_at") @db.DateTime(3)
  createdAt            DateTime @default(now()) @map("created_at") @db.DateTime(3)
  modifiedAt           DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)

  @@unique([adId, reportDate], map: "uq_facebook_ad_insights_key")
  @@index([adsetId],     map: "idx_facebook_ad_insights_adset_id")
  @@index([campaignId],  map: "idx_facebook_ad_insights_campaign_id")
  @@index([reportDate],  map: "idx_facebook_ad_insights_report_date")
  @@index([syncedAt],    map: "idx_facebook_ad_insights_synced_at")
  @@map("facebook_ad_insights")
}
```

Then run (always inside Docker):
```bash
docker exec -it NimbleAPI npx prisma migrate dev --name add_facebook_tables
sudo chown -R $USER:$USER prisma/migrations/
```

**Do not proceed to Step 4 until the migration has run and all 6 tables exist in the DB.**

---

## Step 4 — API Client

**File:** `src/adapters/facebook/facebookClient.ts`

- Token read from `config.FACEBOOK_ACCESS_TOKEN` — never from `process.env` directly
- On error `190` (OAuthException): log FATAL, re-throw immediately — no retry
- Token created once at module load and reused across all page calls
- Rate limiting: Facebook uses a points-based system — inspect `X-Business-Use-Case-Usage` response header; log remaining points; no fixed `sleep` unless header not present

```ts
import { config } from '../../config';
import { FACEBOOK_PLATFORM, FACEBOOK_BASE_URL } from '../../constants/facebook';
import { logger } from '../../utils/logger';

export interface FacebookClientOptions {
  accessToken: string;
  adAccountId: string;    // numeric portion only — client prepends "act_"
}

export function createFacebookClient(): FacebookClientOptions {
  return {
    accessToken: config.FACEBOOK_ACCESS_TOKEN ?? '',
    adAccountId: config.FACEBOOK_AD_ACCOUNT_ID ?? '',
  };
}

export async function facebookGet<T>(
  client: FacebookClientOptions,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${FACEBOOK_BASE_URL}${path}`);
  url.searchParams.set('access_token', client.accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const body = await response.json() as { error?: { code: number; message: string } } & T;

  if (body.error) {
    if (body.error.code === 190) {
      logger.fatal({ platform: FACEBOOK_PLATFORM, errorCode: 190, message: body.error.message }, 'Facebook token invalid — stop retrying');
    } else {
      logger.error({ platform: FACEBOOK_PLATFORM, errorCode: body.error.code, message: body.error.message }, 'Facebook API error');
    }
    throw new Error(`Facebook API error ${body.error.code}: ${body.error.message}`);
  }

  return body;
}
```

---

## Step 5 — Adapters

### 5.1 Campaigns

**File:** `src/adapters/facebook/campaigns.ts`

Endpoint: `GET /act_{adAccountId}/campaigns`
Fields: `id,name,status,objective,created_time,updated_time`
Delta: filter by `updated_time > lastSyncedAt` (Unix timestamp)
Pagination: cursor-based via `paging.cursors.after`

```ts
import { FacebookCampaignRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchCampaigns(lastSyncedAt: Date | null): Promise<FacebookCampaignRaw[]> {
  const client = createFacebookClient();   // one token lookup per call
  const results: FacebookCampaignRaw[] = [];
  let after: string | null = null;

  const baseParams: Record<string, string> = {
    fields: 'id,name,status,objective,created_time,updated_time',
    limit:  '100',
  };
  if (lastSyncedAt) {
    baseParams['filtering'] = JSON.stringify([{
      field: 'updated_time', operator: 'GREATER_THAN', value: Math.floor(lastSyncedAt.getTime() / 1000),
    }]);
  }

  do {
    const params = { ...baseParams, ...(after ? { after } : {}) };
    const page = await facebookGet<FacebookListResponse<FacebookCampaignRaw>>(
      client,
      `/act_${client.adAccountId}/campaigns`,
      params,
    );
    results.push(...page.data);
    after = page.paging?.cursors?.after ?? null;
    logger.info({ platform: FACEBOOK_PLATFORM, module: 'campaigns', fetched: page.data.length, total: results.length }, 'page fetched');
  } while (after);

  return results;
}
```

### 5.2 Ad Sets

**File:** `src/adapters/facebook/adsets.ts`

Endpoint: `GET /act_{adAccountId}/adsets`
Fields: `id,name,campaign_id,status,daily_budget,lifetime_budget,created_time,updated_time`
Same cursor pagination + delta filter pattern as campaigns.

### 5.3 Ads

**File:** `src/adapters/facebook/ads.ts`

Endpoint: `GET /act_{adAccountId}/ads`
Fields: `id,name,adset_id,campaign_id,status,created_time,updated_time`
Same cursor pagination + delta filter pattern.

### 5.4 Campaign Insights

**File:** `src/adapters/facebook/campaignInsights.ts`

Endpoint: `GET /act_{adAccountId}/insights?level=campaign`
Fields: `campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions,action_values,date_start`
`time_increment=1` (one row per day)
Date range: yesterday only (daily cron)
Cursor pagination via `paging.cursors.after`

> **Async insights:** For large accounts the API may return `async_status: "Job Running"`. Adapter must poll `GET /{job_id}` every 5 seconds until `async_status: "Job Complete"`, then fetch `GET /{job_id}/insights`. Implement this inside `campaignInsights.ts` — not in the worker.

### 5.5 Ad Set Insights

**File:** `src/adapters/facebook/adsetInsights.ts`

Same as campaign insights but `?level=adset`. Includes `adset_id`, `adset_name` in response.

### 5.6 Ad Insights

**File:** `src/adapters/facebook/adInsights.ts`

Same as campaign insights but `?level=ad`. Includes `ad_id`, `ad_name`, `adset_id`, `adset_name`.

---

## Step 6 — Transformers

### Actions extraction helper (shared within `facebookRepo.ts`)

The `actions` array `[{action_type, value}]` must be extracted into individual columns. Define this once in the repo file:

```ts
function extractAction(actions: FacebookAction[] | null, actionType: string): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match?.value ? parseInt(match.value, 10) : 0;
}
```

| Column            | `action_type`          |
|-------------------|------------------------|
| `purchases`       | `purchase`             |
| `addToCarts`      | `add_to_cart`          |
| `initiateCheckouts` | `initiate_checkout`  |
| `landingPageViews` | `landing_page_view`   |

### 6.1 Campaign Transformer

**File:** `src/transform/facebook/campaignTransformer.ts`

```ts
import { FacebookCampaignRaw } from '../../types/facebook.types';
import { CampaignInput } from '../../db/repositories/facebookRepo';

export function transformCampaign(raw: FacebookCampaignRaw, syncedAt: Date): CampaignInput {
  return {
    campaignId:    raw.id ?? '',
    campaignName:  raw.name ?? null,
    status:        raw.status ?? null,
    objective:     raw.objective ?? null,
    rawData:       raw,
    syncedAt,
    srcCreatedAt:  raw.created_time ? new Date(raw.created_time) : new Date(0),
    srcModifiedAt: raw.updated_time ? new Date(raw.updated_time) : new Date(0),
  };
}
```

### 6.2 Ad Set Transformer

**File:** `src/transform/facebook/adsetTransformer.ts`

Budget conversion: Facebook returns budget in **minor units** (cents). Divide by 100 before storing.

```ts
import { FacebookAdsetRaw } from '../../types/facebook.types';
import { AdsetInput } from '../../db/repositories/facebookRepo';

export function transformAdset(raw: FacebookAdsetRaw, syncedAt: Date): AdsetInput {
  return {
    adsetId:        raw.id ?? '',
    adsetName:      raw.name ?? null,
    campaignId:     raw.campaign_id ?? null,
    status:         raw.status ?? null,
    dailyBudget:    raw.daily_budget    ? parseFloat(raw.daily_budget) / 100    : null,
    lifetimeBudget: raw.lifetime_budget ? parseFloat(raw.lifetime_budget) / 100 : null,
    rawData:        raw,
    syncedAt,
    srcCreatedAt:  raw.created_time ? new Date(raw.created_time) : new Date(0),
    srcModifiedAt: raw.updated_time ? new Date(raw.updated_time) : new Date(0),
  };
}
```

### 6.3 Ad Transformer

**File:** `src/transform/facebook/adTransformer.ts`

Same pattern as campaign transformer — explicit `: AdInput` return type.

### 6.4 Campaign Insight Transformer

**File:** `src/transform/facebook/campaignInsightTransformer.ts`

```ts
import { FacebookCampaignInsightRaw } from '../../types/facebook.types';
import { CampaignInsightInput } from '../../db/repositories/facebookRepo';
import { extractAction } from '../../db/repositories/facebookRepo';

export function transformCampaignInsight(
  raw: FacebookCampaignInsightRaw,
  syncedAt: Date,
): CampaignInsightInput {
  return {
    campaignId:          raw.campaign_id   ?? '',
    campaignName:        raw.campaign_name ?? null,
    reportDate:          raw.date_start    ? new Date(raw.date_start) : new Date(0),
    spend:               raw.spend         ? parseFloat(raw.spend)    : 0,
    impressions:         raw.impressions   ? parseInt(raw.impressions, 10) : 0,
    clicks:              raw.clicks        ? parseInt(raw.clicks, 10)      : 0,
    reach:               raw.reach         ? parseInt(raw.reach, 10)       : 0,
    frequency:           raw.frequency     ? parseFloat(raw.frequency)     : null,
    ctr:                 raw.ctr           ? parseFloat(raw.ctr)           : null,
    cpc:                 raw.cpc           ? parseFloat(raw.cpc)           : null,
    cpm:                 raw.cpm           ? parseFloat(raw.cpm)           : null,
    purchases:           extractAction(raw.actions, 'purchase'),
    addToCarts:          extractAction(raw.actions, 'add_to_cart'),
    initiateCheckouts:   extractAction(raw.actions, 'initiate_checkout'),
    landingPageViews:    extractAction(raw.actions, 'landing_page_view'),
    conversionsJson:     raw.actions       ?? null,
    conversionValuesJson: raw.action_values ?? null,
    rawData:             raw,
    syncedAt,
  };
}
```

### 6.5 Ad Set Insight Transformer

**File:** `src/transform/facebook/adsetInsightTransformer.ts`

Same pattern — explicit `: AdsetInsightInput` return type. Includes `adsetId`, `adsetName`.

### 6.6 Ad Insight Transformer

**File:** `src/transform/facebook/adInsightTransformer.ts`

Same pattern — explicit `: AdInsightInput` return type. Includes `adId`, `adName`, `adsetId`, `adsetName`. No `frequency` field (ad level does not return it).

---

## Step 7 — Repository

**File:** `src/db/repositories/facebookRepo.ts`

- Export `*Input` interfaces — field names match Prisma model field names exactly (camelCase)
- Chunk size: 200 rows
- `ON DUPLICATE KEY UPDATE` on each table's natural unique key
- SQL column names must match `@map` values in the schema exactly (snake_case)

```ts
export interface CampaignInput {
  campaignId:    string;
  campaignName:  string | null;
  status:        string | null;
  objective:     string | null;
  rawData:       object;
  syncedAt:      Date;
  srcCreatedAt:  Date;
  srcModifiedAt: Date;
}

export interface AdsetInput {
  adsetId:        string;
  adsetName:      string | null;
  campaignId:     string | null;
  status:         string | null;
  dailyBudget:    number | null;
  lifetimeBudget: number | null;
  rawData:        object;
  syncedAt:       Date;
  srcCreatedAt:   Date;
  srcModifiedAt:  Date;
}

export interface AdInput {
  adId:          string;
  adName:        string | null;
  adsetId:       string | null;
  campaignId:    string | null;
  status:        string | null;
  rawData:       object;
  syncedAt:      Date;
  srcCreatedAt:  Date;
  srcModifiedAt: Date;
}

export interface CampaignInsightInput {
  campaignId:           string;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  frequency:            number | null;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

export interface AdsetInsightInput {
  adsetId:              string;
  adsetName:            string | null;
  campaignId:           string | null;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  frequency:            number | null;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

export interface AdInsightInput {
  adId:                 string;
  adName:               string | null;
  adsetId:              string | null;
  adsetName:            string | null;
  campaignId:           string | null;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

// Export the actions extractor — used by transformers
export function extractAction(actions: Array<{ action_type: string | null; value: string | null }> | null, actionType: string): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match?.value ? parseInt(match.value, 10) : 0;
}

export async function upsertCampaigns(rows: CampaignInput[]): Promise<number> { ... }
export async function upsertAdsets(rows: AdsetInput[]): Promise<number> { ... }
export async function upsertAds(rows: AdInput[]): Promise<number> { ... }
export async function upsertCampaignInsights(rows: CampaignInsightInput[]): Promise<number> { ... }
export async function upsertAdsetInsights(rows: AdsetInsightInput[]): Promise<number> { ... }
export async function upsertAdInsights(rows: AdInsightInput[]): Promise<number> { ... }
```

---

## Step 8 — Worker

**File:** `src/workers/facebookWorker.ts`

```ts
import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { FACEBOOK_PLATFORM, FACEBOOK_QUEUE, FACEBOOK_JOBS } from '../constants/facebook';
import { fetchCampaigns }        from '../adapters/facebook/campaigns';
import { fetchAdsets }           from '../adapters/facebook/adsets';
import { fetchAds }              from '../adapters/facebook/ads';
import { fetchCampaignInsights } from '../adapters/facebook/campaignInsights';
import { fetchAdsetInsights }    from '../adapters/facebook/adsetInsights';
import { fetchAdInsights }       from '../adapters/facebook/adInsights';
import { transformCampaign }     from '../transform/facebook/campaignTransformer';
import { transformAdset }        from '../transform/facebook/adsetTransformer';
import { transformAd }           from '../transform/facebook/adTransformer';
import { transformCampaignInsight } from '../transform/facebook/campaignInsightTransformer';
import { transformAdsetInsight }    from '../transform/facebook/adsetInsightTransformer';
import { transformAdInsight }       from '../transform/facebook/adInsightTransformer';
import { upsertCampaigns, upsertAdsets, upsertAds, upsertCampaignInsights, upsertAdsetInsights, upsertAdInsights } from '../db/repositories/facebookRepo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

export const facebookWorker = new Worker(
  FACEBOOK_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: FACEBOOK_PLATFORM, job: job.name }, 'job started');
    const queuedId = await logQueued(FACEBOOK_PLATFORM, job.name);
    const syncLog  = await logRunning(queuedId);

    try {
      const syncedAt = new Date();

      switch (job.name) {
        case FACEBOOK_JOBS.CAMPAIGNS: {
          const lastSyncedAt = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw = await fetchCampaigns(lastSyncedAt);
          const rows = raw.map((r) => transformCampaign(r, syncedAt));
          const saved = await upsertCampaigns(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSETS: {
          const lastSyncedAt = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw = await fetchAdsets(lastSyncedAt);
          const rows = raw.map((r) => transformAdset(r, syncedAt));
          const saved = await upsertAdsets(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADS: {
          const lastSyncedAt = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw = await fetchAds(lastSyncedAt);
          const rows = raw.map((r) => transformAd(r, syncedAt));
          const saved = await upsertAds(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.CAMPAIGN_INSIGHTS: {
          const date = getYesterdayDate();
          const raw  = await fetchCampaignInsights(date);
          const rows = raw.map((r) => transformCampaignInsight(r, syncedAt));
          const saved = await upsertCampaignInsights(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSET_INSIGHTS: {
          const date = getYesterdayDate();
          const raw  = await fetchAdsetInsights(date);
          const rows = raw.map((r) => transformAdsetInsight(r, syncedAt));
          const saved = await upsertAdsetInsights(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.AD_INSIGHTS: {
          const date = getYesterdayDate();
          const raw  = await fetchAdInsights(date);
          const rows = raw.map((r) => transformAdInsight(r, syncedAt));
          const saved = await upsertAdInsights(rows);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        default:
          throw new Error(`facebookWorker: unknown job name: ${job.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logFailure(syncLog.id, { errorMessage, durationMs: Date.now() - startedAt });
      throw error;
    }
  },
  { connection, concurrency: 1, limiter: { max: 5, duration: 1000 } },
);

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];   // "YYYY-MM-DD"
}
```

**Worker registration** — add to `index.ts` as a side-effect import:

```ts
import './src/workers/facebookWorker';
```

---

## Step 9 — Scheduler + index.ts

**`src/queue/scheduler.ts`** — add Facebook entries (all 6 jobs, daily at 4am):

```ts
import { facebookQueue } from './queues';
import { FACEBOOK_JOBS } from '../constants/facebook';

// Inside registerSchedulers():
facebookQueue.add(FACEBOOK_JOBS.CAMPAIGNS,         {}, { repeat: { pattern: '0 4 * * *' } }),
facebookQueue.add(FACEBOOK_JOBS.ADSETS,            {}, { repeat: { pattern: '0 4 * * *' } }),
facebookQueue.add(FACEBOOK_JOBS.ADS,               {}, { repeat: { pattern: '0 4 * * *' } }),
facebookQueue.add(FACEBOOK_JOBS.CAMPAIGN_INSIGHTS, {}, { repeat: { pattern: '0 4 * * *' } }),
facebookQueue.add(FACEBOOK_JOBS.ADSET_INSIGHTS,    {}, { repeat: { pattern: '0 4 * * *' } }),
facebookQueue.add(FACEBOOK_JOBS.AD_INSIGHTS,       {}, { repeat: { pattern: '0 4 * * *' } }),
```

**`src/server/app.ts`** — add `facebookQueue` to Bull Board alongside existing queues.

**Never uncomment scheduler entries until the corresponding worker `case` exists and `tsc --noEmit` passes.**

---

## API Details

### Authentication
| Header | Value |
|---|---|
| Request param | `?access_token={token}` (appended by client) |
| Token type | System User token — never expires |
| On error 190 | Log FATAL, throw immediately — BullMQ will NOT retry |

### Endpoints
| Module | Endpoint |
|---|---|
| Campaigns | `GET /act_{id}/campaigns` |
| Ad Sets | `GET /act_{id}/adsets` |
| Ads | `GET /act_{id}/ads` |
| Campaign insights | `GET /act_{id}/insights?level=campaign` |
| Ad set insights | `GET /act_{id}/insights?level=adset` |
| Ad insights | `GET /act_{id}/insights?level=ad` |

### Pagination
- Cursor-based: `paging.cursors.after` → pass as `?after={cursor}` on next request
- No cursor in response = last page

### Rate Limiting
- Points-based (~60 pts sustained for Standard tier)
- Inspect `X-Business-Use-Case-Usage` response header — log remaining points
- No fixed `sleep` — header-based only

### Insights Date Range
```json
{ "time_range": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" } }
```
- Always use `time_increment=1` (one row per day)
- Daily cron syncs yesterday only

### Async Insights (large accounts)
If response contains `async_status: "Job Running"`:
1. Poll `GET /{job_id}` every 5s
2. When `async_status: "Job Complete"`, fetch `GET /{job_id}/insights`
3. Implement this in the adapter — not in the worker

---

## Sync Schedule

| Module | Frequency |
|---|---|
| Campaigns metadata | Daily at 4am, delta (updated_time filter) |
| Ad Sets metadata | Daily at 4am, delta (updated_time filter) |
| Ads metadata | Daily at 4am, delta (updated_time filter) |
| Campaign insights | Daily at 4am, yesterday only |
| Ad Set insights | Daily at 4am, yesterday only |
| Ad insights | Daily at 4am, yesterday only |

Total: 6 API call groups/day (~6–10 pages/group depending on account size).

---

## Known Limitations

- **Budget minor units:** `daily_budget` / `lifetime_budget` returned in currency's minor units (cents). **Transformer must divide by 100** before storing.
- **Data attribution window:** Insights for a day may update retroactively for up to 28 days. Re-sync the last 7 days weekly (future enhancement — not in Phase 6).
- **Async insights jobs:** Large accounts (500+ campaigns) may get `async_status: "Job Running"`. Adapter must poll until complete.
- **Token expiry:** System User tokens never expire. On error code `190`: log FATAL, do not retry.
- **No `platform_tokens` entry:** Facebook credentials live in env vars only — no DB token storage.

---

## Pre-Ship Verification Checklist

### Types
- [x] Every money field is `string | null` in raw types — null-guarded before `parseFloat` in transformer
- [x] Every metric field is `string | null` in raw types — null-guarded before `parseInt` in transformer
- [x] Facebook IDs are `string | null` — never `number`
- [x] `actions` / `action_values` arrays are `FacebookAction[] | null`

### Schema
- [x] All Facebook IDs: `String @db.VarChar(50)` — never `Int`
- [x] Metadata tables have `srcCreatedAt` + `srcModifiedAt` — insights tables do NOT
- [x] All timestamps: `DateTime @db.DateTime(3)` — never `@db.Date`
- [x] Money fields: `Decimal @db.Decimal(12, 2)`
- [x] Rate metrics (ctr, cpm, cpc, frequency): `Decimal @db.Decimal(8, 4)`
- [x] Count metrics (impressions, clicks, reach): `Int`
- [x] `rawData Json @map("raw_data")` on every table
- [x] Composite `@@unique` on insight tables covers `(entityId, reportDate)`
- [x] All required indexes present (`srcModifiedAt`, `syncedAt`, `reportDate`, foreign keys)

### Adapters
- [x] `createFacebookClient()` called once per `fetch*` function — not once per page
- [x] On error code `190`: log FATAL, throw immediately — no retry loop
- [x] Rate limiting uses header inspection (`X-Business-Use-Case-Usage`), not fixed `sleep`
- [x] Async insight polling implemented in adapters, not in worker
- [x] `act_` prefix prepended by adapter — never stored in env or DB

### Transformers
- [x] Every transformer has an explicit `: *Input` return type — never inferred
- [x] Budget divided by 100 in `adsetTransformer.ts` — both `dailyBudget` and `lifetimeBudget`
- [x] `extractAction` used for all action column extraction — no inline array `.find()` in worker
- [x] All `parseFloat` / `parseInt` calls null-guarded

### Worker
- [x] All local variables are `camelCase`
- [x] `logQueued` + `logRunning` called before `try` block
- [x] `setLastSyncedAt` called **before** `logSuccess` in every case
- [x] `default` case throws — unknown job names fail loudly

### Scheduler + Wiring
- [x] `tsc --noEmit` passes with zero errors
- [x] Every scheduled job has a `case` in the worker
- [x] Worker imported in `index.ts`
- [x] Queue added to Bull Board in `app.ts`
- [x] Scheduler entries use `FACEBOOK_JOBS.*` — no string literals
- [x] Scheduler entries were commented out until worker was complete

---

## Verification Queries

```sql
-- After first run
SELECT platform, job_type, status, records_fetched, records_saved, duration_ms
FROM sync_logs WHERE platform = 'facebook' ORDER BY created_at DESC LIMIT 10;

SELECT COUNT(*) FROM facebook_campaigns;
SELECT COUNT(*) FROM facebook_adsets;
SELECT COUNT(*) FROM facebook_ads;
SELECT COUNT(*) FROM facebook_campaign_insights;
SELECT COUNT(*) FROM facebook_adset_insights;
SELECT COUNT(*) FROM facebook_ad_insights;

-- Verify date stored as DATETIME(3), not string
SELECT campaign_id, report_date, spend, impressions FROM facebook_campaign_insights ORDER BY report_date DESC LIMIT 5;

-- Verify budget division (should be dollars, not cents)
SELECT adset_id, adset_name, daily_budget, lifetime_budget FROM facebook_adsets LIMIT 5;

-- Verify actions extracted correctly
SELECT campaign_id, purchases, add_to_carts, initiate_checkouts FROM facebook_campaign_insights WHERE purchases > 0 LIMIT 5;

-- Verify sync_config updated
SELECT platform, job_type, last_synced_at FROM sync_config WHERE platform = 'facebook';
```
