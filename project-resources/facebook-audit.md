# Facebook Platform Audit

**Date:** 2026-04-16
**Modules audited:** Meta Ads — Campaign, Ad Set, Ad (core data); Campaign Insights, Ad Set Insights, Ad Insights (spend, impressions, clicks, CTR, CPC, conversions)

---

## Bug List

---

### BUG-FB-01

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-01 |
| **Severity** | Critical |
| **Area** | Config |
| **File** | `src/config/index.ts` |
| **API Endpoint** | All Facebook endpoints |
| **API Field** | N/A |
| **Description** | No startup validation for `FACEBOOK_ACCESS_TOKEN` or `FACEBOOK_AD_ACCOUNT_ID` when `FACEBOOK_ENABLED=true`. `createFacebookClient()` silently defaults both to an empty string (`''`). Every API call then fails with a Facebook auth error at runtime. All other platforms (GA4, Klaviyo, Shopify, Cin7) have equivalent fail-fast guards — Facebook is the only one missing them. |
| **Why it matters** | A deployment with missing credentials starts successfully, queues jobs, and only produces errors when the first job runs. The operator has no way to detect the misconfiguration at boot time. Silent auth failures fill the failed-job queue. |
| **Suggested fix** | Add to `src/config/index.ts` after the existing Cin7 guards: `if (config.FACEBOOK_ENABLED && !config.FACEBOOK_ACCESS_TOKEN) { ... process.exit(1); }` and the equivalent for `FACEBOOK_AD_ACCOUNT_ID`. |

---

### BUG-FB-02

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-02 |
| **Severity** | Critical |
| **Area** | Adapter |
| **File** | `src/adapters/facebook/ads.ts` line 16 |
| **API Endpoint** | `GET /act_{ad-account-id}/ads` |
| **API Field** | N/A |
| **Description** | Syntax error: `const baseParams['filtering'] = JSON.stringify(...)`. Using `const` on a property assignment is invalid JavaScript/TypeScript and will prevent the module from loading entirely. Should be `baseParams['filtering'] = JSON.stringify(...)` (no `const`). |
| **Why it matters** | The `ads` adapter module fails to load. The `FACEBOOK_JOBS.ADS` job crashes immediately on startup with a syntax/parse error. No ad-level entity data (ad names, ad statuses) is ever synced. |
| **Suggested fix** | Remove the `const` keyword from line 16: change `const baseParams['filtering'] =` to `baseParams['filtering'] =`. |

---

### BUG-FB-03

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-03 |
| **Severity** | Critical |
| **Area** | Worker |
| **File** | `src/workers/facebookWorker.ts` line 145 |
| **API Endpoint** | All insight endpoints |
| **API Field** | N/A |
| **Description** | Syntax error in `getYesterdayDate()`: `const d.setDate(d.getDate() - 1)` — using `const` on a method call expression is invalid JavaScript/TypeScript and will prevent the worker module from loading entirely. Should be `d.setDate(d.getDate() - 1)` (no `const`). |
| **Why it matters** | The Facebook worker module fails to load entirely. All 6 Facebook jobs (campaigns, adsets, ads, campaign insights, adset insights, ad insights) are dead — none will ever run. |
| **Suggested fix** | Remove the `const` keyword from line 145: change `const d.setDate(d.getDate() - 1);` to `d.setDate(d.getDate() - 1);`. |

---

### BUG-FB-04

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-04 |
| **Severity** | High |
| **Area** | API Types + Schema + Repo |
| **File** | `src/types/facebook.types.ts`, `src/db/repositories/facebookRepo.ts`, `prisma/schema.prisma` |
| **API Endpoint** | `GET /act_{ad-account-id}/insights` (level=ad) |
| **API Field** | `frequency` |
| **Description** | `FacebookAdInsightRaw` (lines 68–84) is missing the `frequency` field. The campaign-insights and adset-insights types both have `frequency: string \| null`, and `FacebookAdInsightRaw` should too — the Facebook API returns `frequency` at the ad level when requested. Similarly, `AdInsightInput` has no `frequency` field, and `FacebookAdInsight` in the schema has no `frequency` column. The adInsights adapter does not request `frequency` in the fields param. All three layers are consistently missing the field. |
| **Why it matters** | Frequency (average number of times a unique user saw the ad) is a key reach-efficiency metric. It is available from the API at ad level but is silently not collected. |
| **Suggested fix** | Add `frequency: string \| null` to `FacebookAdInsightRaw`. Add `frequency: number \| null` to `AdInsightInput`. Add `frequency Decimal? @map("frequency") @db.Decimal(8,4)` to `FacebookAdInsight` schema. Add `frequency` to the adapter fields param string. Add `frequency: raw.frequency ? parseFloat(raw.frequency) : null` in `adInsightTransformer.ts`. |

---

### BUG-FB-05

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-05 |
| **Severity** | High |
| **Area** | Worker |
| **File** | `src/workers/facebookWorker.ts` line 39 |
| **API Endpoint** | N/A |
| **API Field** | N/A |
| **Description** | Worker logs `{ platform, job: job.name }` instead of `{ platform, jobName: job.name }`. The logging rules require `jobName` as the structured field. Every other platform worker uses `jobName`. |
| **Why it matters** | Log queries filtering on `jobName` will miss all Facebook worker log lines. Observability is degraded. |
| **Suggested fix** | Change `job: job.name` to `jobName: job.name` on line 39. |

---

### BUG-FB-06

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-06 |
| **Severity** | Medium |
| **Area** | Worker |
| **File** | `src/workers/facebookWorker.ts` line 127 |
| **API Endpoint** | N/A |
| **API Field** | N/A |
| **Description** | The `default` case in the worker switch throws `Unknown job: ${job.name}` — inconsistent with the project pattern used by all other workers which throw `facebookWorker: unknown job name: ${job.name}`. Minor, but makes log correlation harder. |
| **Why it matters** | Low operational impact, but the error message in BullMQ's failed job log won't mention "facebookWorker" making it harder to identify which worker threw the error. |
| **Suggested fix** | Change `throw new Error(\`Unknown job: ${job.name}\`)` to `throw new Error(\`facebookWorker: unknown job name: ${job.name}\`)`. |

---

### BUG-FB-07

| Field | Value |
|---|---|
| **Bug ID** | BUG-FB-07 |
| **Severity** | Medium |
| **Area** | Worker |
| **File** | `src/workers/facebookWorker.ts` lines 93–124 |
| **API Endpoint** | All insight endpoints |
| **API Field** | N/A |
| **Description** | The three insight jobs (CAMPAIGN_INSIGHTS, ADSET_INSIGHTS, AD_INSIGHTS) always fetch only yesterday's data using `getYesterdayDate()`. On first run (`lastSyncedAt === null`) there is no backfill — only one day of data is ever loaded on the initial sync. All historical insight data before the first sync date is silently lost. |
| **Why it matters** | On a fresh deployment, the DB will only ever contain insight data from yesterday onwards. Any historical performance data (e.g. previous months' spend, impressions, conversions) is permanently unsynced unless someone manually triggers backfill jobs. |
| **Suggested fix** | Check `lastSyncedAt` at the start of each insight job. If `null` (first run), fetch from a configurable historical start date (e.g. `FACEBOOK_HISTORICAL_START_DATE` env var, defaulting to 90 days ago) through yesterday, looping one day at a time and upserting per day. If `lastSyncedAt` is set, only fetch yesterday as currently implemented. |

---

## Summary Table

| Bug ID | Severity | Module(s) | Area | Short Description |
|---|---|---|---|---|
| BUG-FB-01 | **Critical** | Config | Config | No startup validation for `FACEBOOK_ACCESS_TOKEN` / `FACEBOOK_AD_ACCOUNT_ID` |
| BUG-FB-02 | **Critical** | Ads adapter | Adapter | Syntax error: `const baseParams['filtering']` — module fails to load |
| BUG-FB-03 | **Critical** | Worker | Worker | Syntax error: `const d.setDate(...)` — entire worker fails to load |
| BUG-FB-04 | **High** | Ad Insights | Types + Schema + Repo | `frequency` field missing from ad insights across all layers |
| BUG-FB-05 | **High** | Worker | Worker | `job:` should be `jobName:` in structured log |
| BUG-FB-06 | **Medium** | Worker | Worker | `default` case error message missing worker name prefix |
| BUG-FB-07 | **Medium** | Worker | Worker | Insight jobs have no historical backfill on first run |

---

## Files to Modify (when fixes are approved)

| File | Bugs |
|---|---|
| `src/config/index.ts` | BUG-FB-01 |
| `src/adapters/facebook/ads.ts` | BUG-FB-02 |
| `src/workers/facebookWorker.ts` | BUG-FB-03, BUG-FB-05, BUG-FB-06, BUG-FB-07 |
| `src/types/facebook.types.ts` | BUG-FB-04 |
| `src/db/repositories/facebookRepo.ts` | BUG-FB-04 |
| `src/adapters/facebook/adInsights.ts` | BUG-FB-04 |
| `src/transform/facebook/adInsightTransformer.ts` | BUG-FB-04 |
| `prisma/schema.prisma` | BUG-FB-04 |

---

## Migrations Required (after schema changes)

```bash
npx prisma migrate dev --name add_facebook_ad_insight_frequency
```

---

## Status

**Phase 5 — Awaiting user review of bug list.**
