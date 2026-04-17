# Klaviyo Campaign Stats — Date Window Fix Plan

## Problem

`klaviyo_campaign_stats` table is empty after the CAMPAIGN_STATS job runs.
Every batch logs `batchCount: 0` — the Klaviyo API returns zero results.

## Root Cause

The worker hardcodes a 90-day lookback window for the stats API call:

```ts
// src/workers/klaviyoWorker.ts
const statsStart = new Date(syncedAt);
statsStart.setUTCDate(statsStart.getUTCDate() - 90);
```

Today is 2026-04-17, so the window is **2026-01-17 → now**.
All campaigns in `klaviyo_campaigns` were sent before that cutoff, so Klaviyo
returns empty results for every batch.

The 90-day limit is **not** a Klaviyo API requirement — it was an arbitrary
design choice that is too narrow for historical data.

## Why the Fix Is Simple

The CAMPAIGN_STATS job already fetches **every campaign ID** from the DB:

```ts
const allCampaignIds = await getAllKlaviyoCampaignIds();
```

The date window only controls how far back Klaviyo looks for stat events
(opens, clicks). It does not filter which campaigns are included — that is
already handled by passing all IDs. So:

- No 30-day buffer is needed on subsequent runs
- No extra API calls or new repo functions needed
- The only change is how `statsStart` is calculated

## Proposed Fix

### First run (`lastSyncedAt = null`)

Use `MIN(send_time)` from `klaviyo_campaigns` as the stats window start.
This guarantees stats are fetched for every campaign ever synced, regardless
of how old it is.

### Subsequent runs (`lastSyncedAt` is set)

Use `lastSyncedAt` directly as the start. Since all campaign IDs are passed
on every run, any open/click event that occurred after the last sync will be
captured. No buffer required.

### Logic summary

```
First run  → statsStart = MIN(send_time) from klaviyo_campaigns
Subsequent → statsStart = lastSyncedAt
End        → syncedAt (always)
```

---

## Files to Change

### 1. `src/db/repositories/klaviyoRepo.ts`

Add one new query function:

```ts
export async function getOldestKlaviyoCampaignSendTime(): Promise<Date | null>
```

- Runs `SELECT MIN(send_time) FROM klaviyo_campaigns`
- Returns `Date | null` (null if table is empty — no campaigns synced yet)

### 2. `src/workers/klaviyoWorker.ts`

Replace the hardcoded 90-day window in the `CAMPAIGN_STATS` case:

**Before:**
```ts
const statsStart = new Date(syncedAt);
statsStart.setUTCDate(statsStart.getUTCDate() - 90);
```

**After:**
```ts
const statsStart = lastSyncedAt
  ? lastSyncedAt
  : await getOldestKlaviyoCampaignSendTime() ?? syncedAt;
```

- If `lastSyncedAt` is set → use it directly (subsequent run)
- If `lastSyncedAt` is null → use oldest `send_time` from DB (first run)
- Fallback to `syncedAt` if the campaigns table is somehow empty (safe default)

Also add `getOldestKlaviyoCampaignSendTime` to the import from `klaviyoRepo`.

---

## What Does NOT Change

| Thing | Reason |
|---|---|
| `getAllKlaviyoCampaignIds()` | Already correct — fetches all IDs |
| `fetchCampaignStats()` adapter | No change needed |
| `transformCampaignStat()` | No change needed |
| `upsertCampaignStats()` | `ON DUPLICATE KEY UPDATE` already handles re-runs safely |
| Schema / migrations | No new columns needed |
| Scheduler | No change needed |

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No campaigns in DB yet | `getOldestKlaviyoCampaignSendTime` returns null → fallback to `syncedAt` → stats job fetches nothing (correct, nothing to fetch) |
| Campaign with null `send_time` | `MIN(send_time)` ignores nulls in MySQL — safe |
| Very old campaigns (2020, 2021) | Klaviyo API should support wide date ranges — no known hard limit |
| Retry after partial failure | `ON DUPLICATE KEY UPDATE` makes re-upsert safe on all batches |

---

## Verification After Fix

1. Trigger CAMPAIGNS job via Bull Board — confirm campaigns upserted
2. CAMPAIGN_STATS job auto-triggers — confirm `batchCount > 0` in logs
3. Check DB: `SELECT COUNT(*), MIN(synced_at), MAX(synced_at) FROM klaviyo_campaign_stats;`
4. Confirm `sync_logs` shows `status = 'success'` for the CAMPAIGN_STATS job
