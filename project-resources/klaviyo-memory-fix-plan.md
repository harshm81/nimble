# Memory Fix & First-Run Guide — All Platforms

## The Core Problem

All platform adapters accumulate every page of API results into a single in-memory
array before returning to the worker. The worker then transforms and upserts the full
array at once. For small datasets this is fine. For large first-run syncs it is a real
Out-Of-Memory risk.

**Fix:** Change adapters to accept an `onPage` callback. The worker upserts each page
as it arrives. Peak memory = one page of records, regardless of total history size.

---

## Platform-by-Platform Assessment

### Already Safe (No Fix Needed)

| Platform | Job | Why Safe |
|---|---|---|
| GA4 | DAILY | Worker loops one date at a time, upserts each date before moving to next |
| Facebook | CAMPAIGN_INSIGHTS | Same date-loop pattern, per-date upsert |
| Facebook | ADSET_INSIGHTS | Same |
| Facebook | AD_INSIGHTS | Same |

These four jobs already bound memory to one day of data per iteration, regardless of
how many days of history are backfilled. No changes needed.

---

### Needs Fix — Priority Order

| Priority | Platform | Job | First-Run Risk | Reason |
|---|---|---|---|---|
| 1 | **Klaviyo** | PROFILES | HIGH | No date loop. Full subscriber history in one array. 100k–500k+ profiles |
| 2 | **Klaviyo** | EVENTS | HIGH | No date loop. Full event history in one array. Years of clicks + purchases |
| 3 | **Shopify** | ORDERS | HIGH | Orders + line items + refunds all in memory before first upsert |
| 4 | **Shopify** | CUSTOMERS | MEDIUM-HIGH | Full customer base on first run |
| 5 | **Cin7** | ORDERS | HIGH | All orders since account creation on first run |
| 6 | **Cin7** | CONTACTS | MEDIUM-HIGH | Full contact list on first run |
| 7 | **Facebook** | CAMPAIGNS | MEDIUM | Paginated, no date loop |
| 8 | **Facebook** | ADSETS | MEDIUM | Paginated, no date loop |
| 9 | **Facebook** | ADS | MEDIUM | Paginated, no date loop |
| 10 | **Shopify** | PRODUCTS | MEDIUM-HIGH | Products + variants in memory |
| 11 | **Cin7** | PURCHASE_ORDERS | MEDIUM | Paginated accumulator |
| 12 | **Cin7** | CREDIT_NOTES | MEDIUM | Paginated accumulator |
| 13 | **Cin7** | STOCK_ADJUSTMENTS | MEDIUM | Paginated accumulator |

Jobs not listed (Cin7 BRANCHES/INVENTORY, Shopify INVENTORY, Klaviyo CAMPAIGNS/FLOWS)
are low-risk and do not need this fix.

---

## Phase 1 — Klaviyo Fix (Immediate, Before First Run)

Klaviyo is the platform being enabled now. Fix profiles and events first.

### Files Changed

| File | Change |
|---|---|
| `src/adapters/klaviyo/profiles.ts` | Add `onPage` callback, remove accumulator array |
| `src/adapters/klaviyo/events.ts` | Add `onPage` callback, keep metric name map across pages |
| `src/workers/klaviyoWorker.ts` | Update PROFILES and EVENTS cases to use callback |

### How the Fix Works

**Current flow (bad for large datasets):**
```
fetchProfiles() → accumulates ALL pages → returns raw[]
worker: raw.map(transform) → upsertProfiles(allRows)   ← peak RAM = full history
```

**New flow:**
```
fetchProfiles(lastSyncedAt, async (page) => {
  const rows = page.map(r => transformProfile(r, syncedAt));
  await upsertProfiles(rows);                           ← peak RAM = 1 page (100 rows)
})
```

### Special Note for Events Adapter

The metric name lookup map (`metricNameById`) must still accumulate across pages because
Klaviyo returns metric `included` resources only on the page where they first appear.
An event on page 5 may reference a metric that was only included on page 1. The map
must persist for the lifetime of the fetch call — only the event records themselves
are streamed page-by-page.

### Campaigns and Flows — No Change

Campaigns typically number in the hundreds, flows in the dozens. The accumulator
pattern is acceptable for these. No change needed.

---

## Phase 2 — Shopify Fix (Before Shopify Is Enabled)

### Files Changed

| File | Change |
|---|---|
| `src/adapters/shopify/orders.ts` | Add `onPage` callback |
| `src/adapters/shopify/customers.ts` | Add `onPage` callback |
| `src/adapters/shopify/products.ts` | Add `onPage` callback (products + variants together) |
| `src/workers/shopifyWorker.ts` | Update ORDERS, CUSTOMERS, PRODUCTS cases |

Shopify INVENTORY is a full snapshot (no pagination accumulation issue in the same
sense) — review separately if needed.

---

## Phase 3 — Cin7 Fix (Before Cin7 Is Enabled)

### Files Changed

| File | Change |
|---|---|
| `src/adapters/cin7/orders.ts` | Add `onPage` callback |
| `src/adapters/cin7/contacts.ts` | Add `onPage` callback |
| `src/adapters/cin7/purchaseOrders.ts` | Add `onPage` callback |
| `src/adapters/cin7/creditNotes.ts` | Add `onPage` callback |
| `src/adapters/cin7/stockAdjustments.ts` | Add `onPage` callback |
| `src/workers/cin7Worker.ts` | Update all affected cases |

---

## Phase 4 — Facebook Non-Insight Fix (Lower Priority)

### Files Changed

| File | Change |
|---|---|
| `src/adapters/facebook/campaigns.ts` | Add `onPage` callback |
| `src/adapters/facebook/adsets.ts` | Add `onPage` callback |
| `src/adapters/facebook/ads.ts` | Add `onPage` callback |
| `src/workers/facebookWorker.ts` | Update CAMPAIGNS, ADSETS, ADS cases |

Facebook insight jobs (CAMPAIGN_INSIGHTS, ADSET_INSIGHTS, AD_INSIGHTS) already use
a per-date upsert loop — no changes needed for those.

---

## Regression Prevention

Every change follows the same mechanical pattern. Risk of regression is low because:

- `upsertProfiles`, `upsertOrders`, etc. are unchanged — they already accept an array
  and chunk internally at 200 rows
- `transformProfile`, `transformOrder`, etc. are unchanged
- The only change is when upsert is called (per-page vs after all pages)
- `ON DUPLICATE KEY UPDATE` on all tables means retries are always safe

### Test Plan Per Phase

After each phase, verify:

1. **TypeScript compiles** — `tsc --noEmit` passes with zero errors
2. **Trigger the job manually** via Bull Board UI
3. **Check sync_log** — status should be `success`, `records_fetched` and `records_saved`
   should be non-zero
4. **Check the DB table** — row count matches `records_fetched`
5. **Check container memory** — `docker stats` during the job should show flat memory,
   not a spike that grows with record count
6. **Trigger the same job again** — second run should fetch only records modified since
   first run (`records_fetched` will be 0 or very small), confirming `lastSyncedAt`
   cursor was saved correctly

---

## Q1: First-Run Cron Order for Klaviyo

### The Problem with Auto-Start

When `KLAVIYO_ENABLED=true` and the container restarts, `registerSchedulers()` in
[src/queue/scheduler.ts](../src/queue/scheduler.ts) immediately registers all 4 Klaviyo
cron jobs. BullMQ fires them at their next scheduled time — it does NOT wait for your
first manual run to complete.

Cron schedules:
- `klaviyo:events` — every hour at **:40** → fires within minutes of restart
- `klaviyo:profiles` — every 6 hours → fires within hours
- `klaviyo:campaigns` — 5:00 AM daily
- `klaviyo:flows` — 5:05 AM daily

**If you restart at 2 PM, `klaviyo:events` fires at 2:40 PM automatically — before
you have manually triggered flows or campaigns.** This is the wrong order for a first
run and events is also the highest-memory job.

---

### Correct Approach — Two Steps

#### Step 1: Start with crons commented out in scheduler.ts

Before restarting the container, comment out the 4 Klaviyo lines in
[src/queue/scheduler.ts](../src/queue/scheduler.ts):

```ts
// Klaviyo — commented out for controlled first run
// klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGNS, {}, { repeat: { pattern: '0 5 * * *' },   jobId: KLAVIYO_JOBS.CAMPAIGNS }),
// klaviyoQueue.add(KLAVIYO_JOBS.PROFILES,  {}, { repeat: { pattern: '0 */6 * * *' }, jobId: KLAVIYO_JOBS.PROFILES }),
// klaviyoQueue.add(KLAVIYO_JOBS.EVENTS,    {}, { repeat: { pattern: '40 * * * *' },  jobId: KLAVIYO_JOBS.EVENTS }),
// klaviyoQueue.add(KLAVIYO_JOBS.FLOWS,     {}, { repeat: { pattern: '5 5 * * *' },   jobId: KLAVIYO_JOBS.FLOWS }),
```

This means: `KLAVIYO_ENABLED=true` starts the worker (so it can process jobs you add
manually) but no cron fires automatically.

#### Step 2: Add jobs manually one by one via Bull Board

Open Bull Board at `http://localhost:3000/admin/queues`
Login: `admin` / `admin` (from your `.env`)

**How to add a job manually:**
- Click the `klaviyo` queue in the left sidebar
- Click **"Add Job"** button (top right corner)
- Fill in:
  - **Name:** the job name exactly as shown below
  - **Data:** `{}`  (empty object — leave as-is)
- Click **Add**
- The job appears in the Active tab within seconds and starts processing immediately

**Run in this exact order — wait for each to complete before adding the next:**

| Step | Job Name to type | Wait for | Verify in DB |
|---|---|---|---|
| 1 | `klaviyo:flows` | Status = Completed in Bull Board | `SELECT COUNT(*) FROM klaviyo_flows` → non-zero |
| 2 | `klaviyo:campaigns` | Status = Completed | `SELECT COUNT(*) FROM klaviyo_campaigns` → non-zero |
| 3 | `klaviyo:profiles` | Status = Completed | `SELECT COUNT(*) FROM klaviyo_profiles` → non-zero |
| 4 | `klaviyo:events` | Status = Completed | `SELECT COUNT(*) FROM klaviyo_events` → non-zero |

Also verify in `sync_log` table after each step:
```sql
SELECT job_type, status, records_fetched, records_saved, duration_ms
FROM sync_log
WHERE platform = 'klaviyo'
ORDER BY created_at DESC
LIMIT 10;
```
All 4 rows should show `status = 'success'`.

#### Step 3: Uncomment the cron lines and restart

Once all 4 jobs complete successfully, uncomment the 4 lines in `scheduler.ts` and
restart the container. From this point:
- All 4 jobs have `last_synced_at` set in `sync_config`
- Every cron run fetches only records modified since last run — fast and small
- No memory risk on ongoing syncs

---

### Why Order Matters for First Run Only

The order (flows → campaigns → profiles → events) validates the pipeline on small
data first. If auth fails or a DB column is wrong, you find out on flows (< 100 rows)
not on events (potentially hundreds of thousands of rows). After the first successful
run, order doesn't matter — all jobs are incremental and independent.

---

## Q2: Out-of-Scope Items (Future)

- Shopify INVENTORY full-snapshot fix — needs separate design (no `lastSyncedAt`, always
  full pull — page-by-page upsert helps but does not reduce total DB write volume)
- Cin7 PRODUCTS + INVENTORY — medium risk, address in Phase 3
- Adding memory monitoring / alerting to Docker healthcheck
