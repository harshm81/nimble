# Klaviyo Pagination Refactor Plan

## Problem

`fetchCampaigns` and `fetchFlows` currently accumulate all pages into a single in-memory array before returning to the worker, which then transforms and upserts everything in one batch.

**Issues with the current approach:**
- All records sit in memory until the last page is fetched
- If the job crashes mid-pagination, nothing has been saved — full retry from scratch
- Inconsistent with `fetchProfiles` and `fetchEvents`, which already use the correct `onPage` callback pattern

## Standard Pattern (already used by profiles & events)

```
fetch page 1 → transform → upsert → fetch page 2 → transform → upsert → ...
```

Each page is written to DB immediately. If the job crashes on page 8:
- Pages 1–7 are already persisted (`ON DUPLICATE KEY UPDATE` makes the retry safe)
- Retry only re-upserts already-saved rows, then continues from where it left off

---

## Files to Change

### 1. `src/adapters/klaviyo/campaigns.ts`

**Change:** Convert `fetchCampaigns(lastSyncedAt)` from returning `Promise<KlaviyoCampaign[]>` to accepting an `onPage` callback:

```ts
// BEFORE
export async function fetchCampaigns(lastSyncedAt: Date | null): Promise<KlaviyoCampaign[]>

// AFTER
export async function fetchCampaigns(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoCampaign[]) => Promise<void>,
): Promise<void>
```

**Note on `channelByMessageId` map:** This map must still persist across all pages. Klaviyo only includes a `campaign-message` resource on the page where it first appears — later pages reference the same message ID. So the map accumulates globally, but `onPage` is called per-page after stamping channel onto that page's campaigns.

---

### 2. `src/adapters/klaviyo/flows.ts`

**Change:** Same pattern — convert from returning `Promise<KlaviyoFlow[]>` to `onPage` callback:

```ts
// BEFORE
export async function fetchFlows(lastSyncedAt: Date | null): Promise<KlaviyoFlow[]>

// AFTER
export async function fetchFlows(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoFlow[]) => Promise<void>,
): Promise<void>
```

---

### 3. `src/workers/klaviyoWorker.ts` — `KLAVIYO_JOBS.CAMPAIGNS` case

**Change:** Move transform + upsert inside the `onPage` callback. Track `latestModified` incrementally.

```ts
// BEFORE
const rawCampaigns = await fetchCampaigns(lastSyncedAt);
const campaigns = rawCampaigns.map((r) => transformCampaign(r, syncedAt));
const campaignIds = rawCampaigns.map((r) => r.id);
// ... fetch stats, then upsert all at once

// AFTER
let recordsFetched = 0;
let campaignsSaved = 0;
let latestModified: Date | null = null;
const allCampaignIds: string[] = [];

await fetchCampaigns(lastSyncedAt, async (page) => {
  const rows = page.map((r) => transformCampaign(r, syncedAt));
  campaignsSaved += await upsertCampaigns(rows);
  recordsFetched += page.length;
  allCampaignIds.push(...page.map((r) => r.id));
  for (const r of page) {
    const ts = r.attributes.updated_at;
    if (!ts) continue;
    const d = new Date(ts);
    if (latestModified === null || d > latestModified) latestModified = d;
  }
});

// Stats fetch still uses allCampaignIds collected across all pages
const rawStats = await fetchCampaignStats(allCampaignIds, statsStart.toISOString(), now);
```

---

### 4. `src/workers/klaviyoWorker.ts` — `KLAVIYO_JOBS.FLOWS` case

**Change:** Same pattern — move transform + upsert inside `onPage` callback.

```ts
// BEFORE
const raw = await fetchFlows(lastSyncedAt);
const rows = raw.map((r) => transformFlow(r, syncedAt));
const recordsSaved = await upsertFlows(rows);

// AFTER
let recordsFetched = 0;
let recordsSaved = 0;
let latestModified: Date | null = null;

await fetchFlows(lastSyncedAt, async (page) => {
  const rows = page.map((r) => transformFlow(r, syncedAt));
  recordsSaved += await upsertFlows(rows);
  recordsFetched += page.length;
  for (const r of page) {
    const ts = r.attributes.updated;
    if (!ts) continue;
    const d = new Date(ts);
    if (latestModified === null || d > latestModified) latestModified = d;
  }
});
```

---

## What Does NOT Change

- `fetchProfiles` and `fetchEvents` — already use the correct pattern, no changes needed
- `fetchCampaignStats` — uses a different pattern (POST with batched IDs), not paginated the same way
- The `channelByMessageId` accumulation logic — still needed, still spans all pages
- `toRelativePath` — unchanged
- The `debug` logs added for troubleshooting — kept as-is

## Summary of Changes

| File | Change |
|---|---|
| `src/adapters/klaviyo/campaigns.ts` | Return type `Promise<KlaviyoCampaign[]>` → `onPage` callback |
| `src/adapters/klaviyo/flows.ts` | Return type `Promise<KlaviyoFlow[]>` → `onPage` callback |
| `src/workers/klaviyoWorker.ts` | CAMPAIGNS + FLOWS cases updated to use callback pattern |
