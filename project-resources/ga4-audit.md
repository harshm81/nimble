# GA4 Audit — Bug List

**Platform:** Google Analytics 4  
**API Docs:** https://developers.google.com/analytics/devguides/reporting/data/v1  
**Audit Date:** 2026-04-15  
**Status:** Awaiting your review

---

## Modules Audited

Per your confirmed list:
1. Traffic Data
2. User Behaviour — Sessions, Users (new vs returning), Page views, Engagement time
3. E-commerce Events — Product views, Add to cart, Begin checkout, Purchases
4. Product-Level Data — Product impressions, Clicks, Conversion rate per product

Mapped to code modules:
- **Module A:** Sessions (`ga4_sessions`) — covers Traffic Data + User Behaviour
- **Module B:** Ecommerce Events (`ga4_ecommerce_events`) — covers E-commerce Events
- **Module C:** Product Data (`ga4_product_data`) — covers Product-Level Data

---

## Phase 3 — API Reference (confirmed)

**Endpoint:** `POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`  
**Auth:** OAuth 2.0 via Service Account (SDK handles token exchange automatically)  
**Default limit:** 10,000 rows when `limit` not specified  
**Max rows per call:** 250,000  
**Pagination:** offset + limit  
**Quota exhaustion:** HTTP 429 / RESOURCE_EXHAUSTED — SDK throws, BullMQ retries

---

## Bug List

---

### BUG-GA4-01 — Wrong metric name: `itemsPurchased` does not exist — correct name is `itemPurchases` [CRITICAL]

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Area** | Adapter |
| **File** | `src/adapters/ga4/productData.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `itemPurchases` (metric) |

**Description:** The adapter requests `{ name: 'itemsPurchased' }` as a metric. The GA4 Data API v1 does not have a metric named `itemsPurchased`. The correct name is `itemPurchases`.

**Why it matters:** The API will return an error for unknown metric names, or silently return 0/empty for that column. Every `purchases` value stored in `ga4_product_data` is either wrong or the entire product data fetch fails.

**Suggested fix:** Change `{ name: 'itemsPurchased' }` → `{ name: 'itemPurchases' }` in `src/adapters/ga4/productData.ts`. Also update the `parseRows` mapper key from `row['itemsPurchased']` → `row['itemPurchases']`.

---

### BUG-GA4-02 — Missing module: "New vs Returning Users" not captured anywhere [HIGH]

| Field | Detail |
|---|---|
| **Severity** | High |
| **Area** | Adapter / Schema |
| **File** | `src/adapters/ga4/sessions.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `newVsReturning` (dimension) |

**Description:** Your module list includes "Users (new vs returning)" as a distinct data point. The GA4 API provides a `newVsReturning` dimension that returns `"new"` or `"returning"` per row. The sessions adapter does not request this dimension — it only fetches `newUsers` (count), which is an aggregate across all rows. There is no way to break down returning vs new users by source/medium/campaign from the current data.

**Why it matters:** The `ga4_sessions` table stores `new_users` as a total count, but you cannot report "returning users by campaign" or "new vs returning by device" from the stored data. The dimension is missing entirely.

**Suggested fix:** Add `{ name: 'newVsReturning' }` as a dimension to the sessions report request. Add a `newVsReturning` column (`VarChar(20)`) to `ga4_sessions` table, include it in the unique key, and store it through the transformer.

---

### BUG-GA4-03 — Wrong metric for session attribution: `sessionSource`/`sessionMedium` vs `manualSource`/`manualMedium` [HIGH]

| Field | Detail |
|---|---|
| **Severity** | High |
| **Area** | Adapter |
| **File** | `src/adapters/ga4/sessions.ts`, `src/adapters/ga4/ecommerceEvents.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `sessionSource`, `sessionMedium`, `sessionCampaignName` (dimensions) |

**Description:** The API docs list `sessionSource`, `sessionMedium`, and `sessionCampaignName` as valid session-scoped dimensions. These are correctly used in the adapters. However, the API schema also shows `manualSource`, `manualMedium`, and `manualCampaignName` as separate dimensions that are nullable (can return blank). The current code uses the non-manual session variants — these are correct for session-level attribution. This is **not a bug** in dimension selection.

**However:** `sessionCampaignName` returns `"(not set)"` for direct/organic traffic — the transformer coerces this to `''` (empty string) via `raw.campaign ?? ''`. Storing empty string `''` for `(not set)` causes the unique key `(propertyId, reportDate, source, medium, campaign, deviceCategory)` to work correctly, but the empty string is misleading — it should store `'(not set)'` as-is, matching GA4's own representation and making it queryable.

**Why it matters:** Querying `WHERE campaign = ''` vs `WHERE campaign = '(not set)'` returns different results. Other platforms/tools store `(not set)` — mixing conventions makes cross-platform reporting inconsistent.

**Suggested fix:** In `sessionTransformer.ts`, change `raw.campaign ?? ''` → `raw.campaign ?? '(not set)'`. Same for `source`, `medium`, `deviceCategory` fallbacks — use `'(not set)'` instead of `''`.

---

### BUG-GA4-04 — `viewItemEvents` column design is broken — mixes event types in one column [HIGH]

| Field | Detail |
|---|---|
| **Severity** | High |
| **Area** | Adapter / Schema |
| **File** | `src/adapters/ga4/ecommerceEvents.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `eventCount` (metric), `eventName` (dimension) |

**Description:** The ecommerce adapter requests `eventCount` as a metric and uses this logic:
```ts
viewItemEvents: row['eventName'] === 'view_item' ? (row['eventCount'] || null) : null,
```
For `add_to_cart`, `begin_checkout`, and `purchase` rows, `viewItemEvents` is `null`. The transformer then coerces `null → 0` via `raw.viewItemEvents ? parseInt(...) : 0`. This stores `0` for `view_item_events` on every non-view_item row.

The result: the `view_item_events` column contains `0` for 3 out of 4 event types and only has a real value for `view_item` rows. The column is semantically wrong for 75% of records.

**Additionally:** The GA4 API has a dedicated metric `itemViewEvents` for product view tracking, which is more accurate than using `eventCount` filtered by dimension value.

**Why it matters:** Reporting on `view_item_events` across all event types returns mostly zeros, making the data misleading. A query like `SUM(view_item_events)` gives a correct total only if you also filter `WHERE event_name = 'view_item'`, which makes the column redundant.

**Suggested fix:** Remove `viewItemEvents` from the ecommerce events table. `view_item` is already its own row (since `eventName` is a dimension) — the count is `eventCount` for that row. Use `itemViewEvents` metric in the product data report instead, where it belongs.

---

### BUG-GA4-05 — `engagementSeconds` truncates decimal — GA4 returns float seconds [MEDIUM]

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Area** | Transformer |
| **File** | `src/transform/ga4/sessionTransformer.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `userEngagementDuration` (metric, Float) |

**Description:** GA4's `userEngagementDuration` returns a float string (e.g., `"1523.847"`). The transformer uses `parseInt(raw.engagementSeconds, 10)` which truncates the decimal portion. Up to 0.999s per row is silently lost.

**Why it matters:** For high-traffic sites with many rows, cumulative truncation error across all sessions is significant. `Math.round()` would give a more accurate integer.

**Suggested fix:** Change `parseInt(raw.engagementSeconds, 10)` → `Math.round(parseFloat(raw.engagementSeconds))` in `sessionTransformer.ts`.

---

### BUG-GA4-06 — `revenue` uses `parseFloat` into `DECIMAL(12,2)` — floating point precision loss [MEDIUM]

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Area** | Transformer |
| **File** | `src/transform/ga4/ecommerceEventTransformer.ts`, `src/transform/ga4/productDataTransformer.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | `purchaseRevenue`, `itemRevenue` (metrics, Float) |

**Description:** GA4 returns revenue as a string like `"1234.5678"`. `parseFloat()` converts it to a JS IEEE 754 float, which can introduce rounding errors (e.g., `1234.5678` → `1234.5677999999999`). This float is then inserted into `DECIMAL(12,2)`, where MySQL rounds it — but the rounding happens on an already-imprecise float, not the original string.

**Why it matters:** Revenue figures stored in the DB may differ by a cent or fraction from the actual GA4 values, causing reconciliation discrepancies.

**Suggested fix:** Pass revenue as a `Prisma.Decimal` constructed from the raw string: `new Prisma.Decimal(raw.revenue ?? '0')`. This preserves precision end-to-end.

---

### BUG-GA4-07 — `setLastSyncedAt` stores wall-clock time — causes empty date range on every subsequent run [CRITICAL]

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Area** | Worker |
| **File** | `src/workers/ga4Worker.ts` |
| **API Endpoint** | N/A |
| **API Field** | N/A |

**Description:** After a successful sync, the worker calls:
```ts
await setLastSyncedAt(GA4_PLATFORM, job.name, syncedAt);
```
`syncedAt` is `new Date()` at the time the job ran — e.g., `2026-04-15T03:00:00Z`. On the next run, `getDateRange(lastSyncedAt)` computes:
```
start = 2026-04-15T03:00:00Z + 1 day = 2026-04-16T03:00:00Z
yesterday = 2026-04-15T00:00:00 (local midnight)
start > yesterday → dates array is EMPTY
```
Every run after the first produces zero dates and syncs nothing — silently.

**Why it matters:** The integration appears to succeed (no error logged) but stores no data after the first run.

**Suggested fix:** Store the last processed `report_date` (as a date string e.g. `"2026-04-14"`) rather than `syncedAt`. The `getDateRange` function should parse this string back to a Date and compute the next day from it.

---

### BUG-GA4-08 — `getDateRange` uses local system time — timezone-unsafe date arithmetic [HIGH]

| Field | Detail |
|---|---|
| **Severity** | High |
| **Area** | Worker |
| **File** | `src/workers/ga4Worker.ts` |
| **API Endpoint** | N/A |
| **API Field** | N/A |

**Description:** The `getDateRange` function uses local-time `Date` methods:
```ts
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
```
If the server timezone is not UTC, these calculations are offset relative to UTC. When the 3 AM cron fires in a non-UTC timezone, "yesterday" may refer to a different calendar date than intended.

**Why it matters:** In a UTC+10 timezone, 3 AM local is 5 PM UTC the previous day. `yesterday` in local time is correct for the local calendar, but GA4 processes data by UTC date. This can cause dates to be double-synced or skipped.

**Suggested fix:** Replace all `setDate`/`getDate`/`setHours` calls with UTC equivalents: `setUTCDate`, `getUTCDate`, `setUTCHours(0,0,0,0)`. Use `toISOString().split('T')[0]` for string formatting (already correct in the current code).

---

### BUG-GA4-09 — First run syncs only yesterday — no historical backfill [MEDIUM]

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Area** | Worker |
| **File** | `src/workers/ga4Worker.ts` |
| **API Endpoint** | N/A |
| **API Field** | N/A |

**Description:** When `lastSyncedAt === null` (first run), `getDateRange` returns only yesterday's date. The comment in the code says "full historical backfill should be triggered manually by clearing the sync_config row" — but no mechanism or tooling exists for this. All historical GA4 data is permanently skipped on first deploy.

**Why it matters:** On first deployment you lose all historical traffic, ecommerce, and product data prior to the deployment date. For a reporting platform this is a significant gap.

**Suggested fix:** Support a `GA4_HISTORICAL_START_DATE` env var (e.g., `2024-01-01`). On first run when `lastSyncedAt === null`, use this date as the range start instead of yesterday. If the env var is not set, default to 90 days ago as a safe lookback.

---

### BUG-GA4-10 — `GA4_PROPERTY_ID` not validated when GA4 is enabled — silent API errors [HIGH]

| Field | Detail |
|---|---|
| **Severity** | High |
| **Area** | Config |
| **File** | `src/config/index.ts`, `src/adapters/ga4/sessions.ts`, `src/adapters/ga4/ecommerceEvents.ts`, `src/adapters/ga4/productData.ts` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | N/A |

**Description:** All three adapters use `config.GA4_PROPERTY_ID ?? ''`. If the env var is missing, the API call goes to `properties/` (empty property path). The config schema marks `GA4_PROPERTY_ID` as `z.string().optional()` even when `GA4_ENABLED=true`. The error from the API is a cryptic 400/404, not a clear startup message.

**Why it matters:** A misconfigured deployment silently fails — the worker starts, jobs run, API calls fail, BullMQ retries indefinitely, consuming quota tokens on failed requests.

**Suggested fix:** In `config/index.ts`, add a post-parse check: if `GA4_ENABLED === true && !GA4_PROPERTY_ID`, write to `process.stderr` and call `process.exit(1)`. Same for `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

### BUG-GA4-11 — No `conversion rate per product` — missing derived metric / not storable as-is [MEDIUM]

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Area** | Schema / Adapter |
| **File** | `src/adapters/ga4/productData.ts`, `prisma/schema.prisma` |
| **API Endpoint** | `POST .../properties/{id}:runReport` |
| **API Field** | N/A (no direct API metric) |

**Description:** Your module list includes "Conversion rate per product". The GA4 Data API does not provide a `conversionRate` metric at the item/product level. Conversion rate must be calculated: `purchases / itemViews`. The current schema stores both `purchases` and `item_views`, so the rate can be computed at query time, but it is not stored as a column, and there is no documentation of this in the codebase.

**Why it matters:** If a downstream dashboard expects a `conversion_rate` column in `ga4_product_data`, it will not find one. The calculation must be done in SQL or application logic.

**Suggested fix:** Either (a) add a computed/stored column `conversion_rate DECIMAL(8,4)` populated in the transformer as `purchases / itemViews` (with a zero-division guard), or (b) document clearly that conversion rate is a derived metric computed as `purchases / item_views` at query time. Option (b) is preferred — storing derived values that can be recomputed is redundant.

---

### BUG-GA4-12 — `parseGa4Date` duplicated in three transformer files [LOW]

| Field | Detail |
|---|---|
| **Severity** | Low |
| **Area** | Code Quality |
| **File** | `src/transform/ga4/sessionTransformer.ts`, `ecommerceEventTransformer.ts`, `productDataTransformer.ts` |
| **API Endpoint** | N/A |
| **API Field** | N/A |

**Description:** Identical `parseGa4Date` function copy-pasted in all three transformer files. If the date parsing logic needs to change (e.g., for BUG-GA4-08), it must be updated in three places — risk of inconsistency.

**Suggested fix:** Extract to `src/transform/ga4/utils.ts` and import in all three transformers.

---

### BUG-GA4-13 — `rawData` stores intermediate parsed row, not the original API response [LOW]

| Field | Detail |
|---|---|
| **Severity** | Low |
| **Area** | Data Quality |
| **File** | All three transformers |
| **API Endpoint** | N/A |
| **API Field** | N/A |

**Description:** All transformers pass `rawData: raw` — where `raw` is the already-mapped `GA4SessionRow` / `GA4EcommerceEventRow` / `GA4ProductDataRow` object (the intermediate named representation after `parseRows`). The original API response (`dimensionValues`, `metricValues` arrays indexed by position) is discarded. The `raw_data` column in the DB contains the intermediate shape, not the true API payload.

**Why it matters:** If debugging is needed (e.g., "why is this value wrong?"), the stored `raw_data` cannot be replayed against the API schema — the dimension/metric index mapping is already resolved and the original array structure is lost.

**Suggested fix:** Pass the original `GA4ReportRow` object (before `parseRows` mapping) as `rawData`. This requires threading the original row through `parseRows` alongside the mapped object.

---

## Summary Table

| Bug ID | Module | Severity | Area | Short Description |
|---|---|---|---|---|
| GA4-01 | Product Data | **Critical** | Adapter | `itemsPurchased` metric name wrong — correct is `itemPurchases` |
| GA4-07 | All | **Critical** | Worker | Wall-clock cursor causes empty date range after first run |
| GA4-02 | User Behaviour | **High** | Adapter/Schema | `newVsReturning` dimension not fetched or stored |
| GA4-04 | Ecommerce Events | **High** | Adapter/Schema | `viewItemEvents` column stores `0` for 75% of rows — broken design |
| GA4-08 | All | **High** | Worker | Date arithmetic uses local time — timezone-unsafe |
| GA4-10 | All | **High** | Config | `GA4_PROPERTY_ID` not validated at startup — silent API failures |
| GA4-03 | Traffic/Behaviour | **Medium** | Transformer | `(not set)` coerced to `''` — should store `'(not set)'` as-is |
| GA4-05 | User Behaviour | **Medium** | Transformer | `parseInt` truncates float `userEngagementDuration` |
| GA4-06 | Ecommerce/Product | **Medium** | Transformer | `parseFloat` loses precision before `DECIMAL(12,2)` |
| GA4-09 | All | **Medium** | Worker | First run syncs only yesterday — no historical backfill |
| GA4-11 | Product Data | **Medium** | Schema | Conversion rate per product not stored — derived metric only |
| GA4-12 | All | **Low** | Code Quality | `parseGa4Date` duplicated in 3 files |
| GA4-13 | All | **Low** | Data Quality | `rawData` stores intermediate row, not original API response |

---

## What Happens Next

1. You review this bug list
2. Confirm, remove, or add anything
3. Once approved → we move to **Phase 6 (Fix)** in order: Critical → High → Medium → Low
4. After GA4 fixes are done and you say **"Done"** → we start Klaviyo (you provide the module list)
