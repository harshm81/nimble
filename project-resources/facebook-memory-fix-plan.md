# Facebook Memory Fix Plan

## Context

Facebook is currently disabled (`FACEBOOK_ENABLED=false`). The insight jobs
(CAMPAIGN_INSIGHTS, ADSET_INSIGHTS, AD_INSIGHTS) are already safe — they use a
per-date upsert loop in the worker. Only the structural jobs (CAMPAIGNS, ADSETS, ADS)
use the accumulator pattern and need fixing.

---

## Jobs That Need Fixing

| Job | First-Run Risk | Reason |
|---|---|---|
| ADS | MEDIUM | All ads across all campaigns, paginated |
| ADSETS | MEDIUM | All adsets, paginated |
| CAMPAIGNS | MEDIUM | All campaigns, paginated |

Jobs that do NOT need fixing:

| Job | Reason Safe |
|---|---|
| CAMPAIGN_INSIGHTS | Worker date loop — upserts each date before fetching next |
| ADSET_INSIGHTS | Same date-loop pattern |
| AD_INSIGHTS | Same date-loop pattern |

Facebook structural records (campaigns, adsets, ads) tend to number in the thousands
rather than hundreds of thousands, so the risk is medium rather than high. However,
applying the fix keeps the codebase consistent and prevents issues on large accounts.

---

## Files to Change

| File | Change |
|---|---|
| `src/adapters/facebook/campaigns.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/facebook/adsets.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/facebook/ads.ts` | Add `onPage` callback, remove accumulator |
| `src/workers/facebookWorker.ts` | Update CAMPAIGNS, ADSETS, ADS cases |

---

## How the Fix Works

Facebook adapters use cursor-based pagination (`after` cursor from paging.cursors).
The fix follows the same onPage callback pattern as all other platforms.

**Current:**
```
fetchCampaigns(lastSyncedAt)
  → cursor loop, accumulate all pages → return raw[]
worker:
  rows = raw.map(transformCampaign)
  await upsertCampaigns(rows)
```

**New:**
```
fetchCampaigns(lastSyncedAt, async (page) => {
  const rows = page.map(r => transformCampaign(r, syncedAt));
  await upsertCampaigns(rows);
})
```

---

## What Does NOT Change

- `upsertCampaigns`, `upsertAdsets`, `upsertAds` in `facebookRepo.ts` — unchanged
- All transformer functions — unchanged
- Insight jobs (CAMPAIGN_INSIGHTS, ADSET_INSIGHTS, AD_INSIGHTS) — unchanged
- `ON DUPLICATE KEY UPDATE` on all tables — retries remain safe

---

## Regression Test Plan

After implementation:

1. `tsc --noEmit` — zero errors
2. Enable Facebook temporarily with valid credentials in `.env`
3. Trigger `facebook:campaigns` → confirm success in `sync_log`
4. Confirm `facebook_campaigns` row count is correct
5. Trigger `facebook:adsets` and `facebook:ads` — same checks
6. Trigger `facebook:campaign_insights` — confirm date-loop jobs still work correctly
   (these were not changed, but confirm no regression)
7. Second run of each job should be near-zero fetched (incremental cursor)
