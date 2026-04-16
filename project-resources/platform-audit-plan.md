# Platform Audit Plan

## Objective

Systematically audit every platform integration in the nimble-api codebase — one platform at a time — to verify that:
- The correct data is being fetched from the API
- The data is correctly transformed and stored in the database
- Data types match between API response → transformer → DB column
- Authentication is correct
- Rate limits are respected
- No data is silently lost, truncated, or corrupted

No code changes happen during auditing. Only after you confirm the bug list for a platform do we move to fixing.

---

## Platform Order

| # | Platform | API Docs Reference |
|---|---|---|
| 1 | Google Analytics 4 | https://developers.google.com/analytics/devguides/reporting/data/v1 |
| 2 | Klaviyo | https://developers.klaviyo.com/en/reference/api_overview |
| 3 | Shopify | https://shopify.dev/docs/api/admin-graphql/latest/queries/cartTransforms |
| 4 | Cin7 | https://api.cin7.com/api |
| 5 | Facebook | https://developers.facebook.com/docs/marketing-api |

---

## Audit Lifecycle (per platform)

```
Phase 1 — You provide the module list for the platform
Phase 2 — Read the Code
Phase 3 — Read the API Docs (find correct endpoint per module)
Phase 4 — Compare API response fields vs code vs database
Phase 5 — Produce Bug List → You Review
Phase 6 — Fix (after your approval)
Phase 6b — Tests: unit tests + integration test + seed script
Phase 7 — You confirm "Done" → move to next platform
```

---

## Phase 1 — You Provide the Module List

**You** supply the list of modules (resources) that need to be audited for the platform before any work begins.

Example format you will provide:

```
Cin7
1. Sales Orders
2. Order Line Items
3. Customers
4. Products
5. Inventory
6. Purchase orders (supplier data)
7. Returns/refunds
8. Stock adjustments
```

Only the modules you list will be audited. No assumptions are made about what to include.

**Once you provide the list, the audit begins for those modules only.**

---

## Phase 2 — Read the Code

For each module in the list you provided, read every layer of the integration stack completely:

| Layer | File(s) |
|---|---|
| Constants | `src/constants/<platform>.ts` |
| API Types | `src/types/<platform>.types.ts` |
| Schema | `prisma/schema.prisma` — platform models |
| Repo Interfaces | `src/db/repositories/<platform>Repo.ts` — `*Input` interfaces |
| Transformers | `src/transform/<platform>/<resource>Transformer.ts` |
| Adapters | `src/adapters/<platform>/<resource>.ts` |
| API Client | `src/adapters/<platform>/<platform>Client.ts` |
| Worker | `src/workers/<platform>Worker.ts` |
| Scheduler | `src/queue/scheduler.ts` — platform section |
| Config | `src/config/index.ts` — platform env vars |

**Goal:** Capture the exact fields, types, and logic used at every layer for every module.

---

## Phase 3 — Read the API Docs & Find the Correct Endpoints

Using only the approved API docs URL for this platform, find — for each module:

1. **Correct endpoint URL** — the exact path to call for this resource
2. **Authentication method** — how credentials are passed (header, query param, OAuth, etc.)
3. **Request parameters** — required fields, filters, pagination parameters, field selectors
4. **Response structure** — exact field names returned by the API, their data types, which are nullable
5. **Rate limits** — requests per minute/day, quota headers, retry-after behaviour
6. **Pagination mechanism** — cursor / offset / page-number; how to detect last page

**Output per module:** Confirmed endpoint URL + full list of API response fields with their types.

---

## Phase 4 — Compare API Response vs Code vs Database

For each module, perform a field-by-field comparison across three layers:

```
API Response field  →  Transformer field  →  DB column
(name + type)          (name + type)          (name + type + nullable?)
```

Check every column in this comparison:

| Check | Question |
|---|---|
| Field name | Does the code request/read the exact field name the API returns? |
| Field presence | Are there API fields we are ignoring that should be stored? |
| Nullable | Is the field typed as `T \| null` if the API can return null? |
| Data type | String → int/float parsed correctly? Decimal precision preserved? |
| Date format | Is the date timezone-safe? Is the DB column `DATE` vs `DATETIME` correct? |
| DB column name | Does the SQL `@map` column name match what's in `$executeRaw`? |
| NOT NULL safety | Is a nullable API field being inserted into a NOT NULL DB column? |
| Unique key | Do the natural key fields guarantee uniqueness across records? |
| Upsert coverage | Does `ON DUPLICATE KEY UPDATE` update all non-key fields? |
| Cursor | Does `lastSyncedAt` advance to the right source value (not wall-clock)? |
| Rate limit | Is the platform's rate limit respected? Any quota exhaustion risk? |
| Auth | Are credentials validated at startup? Is the auth flow correct? |

---

## Phase 5 — Bug List

Cross-reference code (Phase 2) against API docs (Phase 3) across these dimensions:

### 4a — Module Coverage
- Are all meaningful API resources being fetched?
- Are any important fields being ignored or missing from the schema?

### 4b — Authentication
- Is the auth mechanism correctly implemented?
- Are credentials validated at startup (fail fast if missing)?
- Is token refresh handled if applicable?

### 4c — API Request Correctness
- Are the correct endpoints/queries used?
- Are dimension/metric/field names spelled exactly as per docs?
- Are required parameters present?
- Are optional parameters used correctly?

### 4d — Response Parsing
- Does the type definition (`src/types/<platform>.types.ts`) match the real API response shape?
- Are nullable fields typed as `T | null`?
- Are all fields actually present in the API response or are some assumed?

### 4e — Data Transformation
- Do transformers have explicit return types matching the `*Input` interface?
- Are money/decimal fields parsed safely (no float precision loss)?
- Are date fields parsed correctly (timezone-safe)?
- Are integer fields parsed with the right method (`parseInt` vs `Math.round`)?
- Are null values handled with guards before parsing?

### 4f — Database Column Alignment
- Does every field in `*Input` map to a real column in the Prisma schema?
- Do SQL column names in raw `$executeRaw` queries match `@map` values in the schema?
- Are data types appropriate? (`DECIMAL` for money, `DATE` vs `DATETIME` for dates, `INT` vs `BIGINT` for counts)
- Are `NOT NULL` columns receiving nullable values from the transformer?
- Are unique key columns receiving values that guarantee uniqueness?

### 4g — Upsert / Idempotency
- Does `ON DUPLICATE KEY UPDATE` cover the correct natural key?
- Are all non-key fields updated on conflict?
- Is chunk size appropriate (≤ 200 rows)?

### 4h — Incremental Sync Cursor
- Is `lastSyncedAt` / cursor correctly read and written?
- Does the cursor advance to the right value (source timestamp, not wall-clock)?
- On first run, is the correct historical range fetched?

### 4i — Rate Limiting
- Does the integration respect the platform's rate limits?
- Is there backpressure if quota runs low?
- Are retries safe (idempotent upserts mean retrying is always safe)?

### 4j — Worker Structure
- Is `logQueued` + `logRunning` called before the `try` block?
- Is `setLastSyncedAt` called before `logSuccess`?
- Does the `default` case throw for unknown job names?
- Is the worker registered in `index.ts`?
- Is the scheduler entry using constants (not string literals)?

---

## Phase 5 — Bug List

Produce a numbered bug list in a dedicated file:

```
project-resources/<platform>-audit.md
```

Each bug entry includes:

| Field | Content |
|---|---|
| **Bug ID** | e.g., `BUG-GA4-01` |
| **Severity** | Critical / High / Medium / Low |
| **Area** | Adapter / Transformer / Schema / Worker / Config / Code Quality |
| **File** | Exact file path |
| **API Endpoint** | The endpoint this bug relates to |
| **API Field** | The specific field name from the API response (if applicable) |
| **Description** | What is wrong |
| **Why it matters** | What breaks or goes wrong at runtime |
| **Suggested fix** | What the correct behaviour should be — no code written yet |

A summary table at the end groups all bugs by module and severity.

**You review the bug list. Once confirmed, we move to Phase 6.**

---

## Phase 6 — Fix

Fix bugs in severity order: Critical → High → Medium → Low.

Each fix follows the project rules:
- No `any` types
- No raw SQL outside Prisma migrations
- No `console.log` — use `logger`
- All migration naming: `npx prisma migrate dev --name <descriptive_name>`
- Schema changes require a migration before any code change

Fixes are committed incrementally. After each fix you can verify.

---

## Phase 7 — Done

You test / review the fixes and say **"Done"** for that platform.

We then move to the next platform in the order and repeat Phases 1–7.

---

## Phase 6 — Testing (added)

After all bugs are fixed, write tests that prove the fixes hold and that real data will be inserted correctly:

### Unit Tests — `src/transform/<platform>/__tests__/`

One test file per transformer. Tests are pure functions — no DB, no credentials needed. Cover:

- All fields mapped correctly from a complete fixture row
- Each nullable field falls back to the correct sentinel (`(not set)`, `null`, `0`)
- Money fields are `Prisma.Decimal` instances, not floats
- Integer metrics use the right parse method (`parseInt` vs `Math.round`)
- Date parsing produces UTC midnight `Date` objects
- Missing/empty date field throws

Run anywhere: `npm run test:unit`

### Integration Tests — `src/workers/__tests__/<platform>Pipeline.test.ts`

One test file per platform pipeline. Mocks only the adapter (no real credentials). Uses real transformers, real repos, real DB. Cover:

- All 3 (or N) tables receive rows with correct field values
- Upsert is idempotent — second run does not duplicate rows
- Specific bug-fix assertions (e.g., `purchases` non-zero after `itemPurchases` metric fix)
- Revenue stored as exact DECIMAL
- Cursor (`sync_config.last_synced_at`) advances to the last processed date

Fixture shape must match the **exact API response format** from the platform's docs.

`beforeAll` / `afterAll` clean up test rows using a dedicated `property_id` / identifier that is never used by real data.

Run inside Docker: `npm run test:integration`

### Seed Script — `src/scripts/seed<Platform>TestData.ts`

A one-off script that inserts the same fixtures as the integration test but **does not clean up**. Used to visually inspect rows in the DB.

Run inside Docker:
```bash
npx tsx src/scripts/seed<Platform>TestData.ts
```

Clean up manually:
```sql
DELETE FROM <table> WHERE property_id = 'test-property-<platform>-seed';
```

---

## Conventions for Bug Severity

| Severity | Meaning |
|---|---|
| **Critical** | Integration is broken — data not reaching the DB at all, or crashes on startup |
| **High** | Data is silently wrong, corrupted, or lost — no error thrown but wrong values stored |
| **Medium** | Functional but unreliable — edge cases cause failures or data gaps |
| **Low** | Code quality, minor inaccuracies, or maintainability issues with no immediate runtime impact |

---

## API Docs Reference (do not use any other URLs)

| Platform | Docs URL |
|---|---|
| Google Analytics 4 | https://developers.google.com/analytics/devguides/reporting/data/v1 |
| Shopify | https://shopify.dev/docs/api/admin-graphql/latest/queries/cartTransforms |
| Cin7 | https://api.cin7.com/api |
| Klaviyo | https://developers.klaviyo.com/en/reference/api_overview |
| Facebook | https://developers.facebook.com/docs/marketing-api |

These are the only reference URLs used during the audit. No other external sources.

---

## Current Status

| # | Platform | Phase | Status |
|---|---|---|---|
| 1 | Google Analytics 4 | **7 — Done** | All 13 bugs fixed. 35 unit tests + 20 integration tests passing. Seed script at `src/scripts/seedGa4TestData.ts`. |
| 2 | Klaviyo | **7 — Done** | All 11 bugs fixed (BUG-KLV-12 deferred). 53 unit tests + 36 integration tests passing. Seed script at `src/scripts/seedKlaviyoTestData.ts`. |
| 3 | Shopify | **7 — Done** | All 9 bugs fixed. 5 unit test files + 1 integration test (pipeline) passing. Seed script at `src/scripts/seedShopifyTestData.ts`. |
| 4 | Cin7 | **7 — Done** | All 7 bugs fixed. 8 unit test files (217 tests) + 1 integration pipeline test passing. Seed script at `src/scripts/seedCin7TestData.ts`. |
| 5 | Facebook | **7 — Done** | All 7 bugs fixed. 6 unit test files (120 tests) + 1 integration pipeline test passing. Seed script at `src/scripts/seedFacebookTestData.ts`. |

### GA4 — Deliverables

| Deliverable | Location |
|---|---|
| Bug audit | `project-resources/ga4-audit.md` |
| Unit tests (35) | `src/transform/ga4/__tests__/` |
| Integration test (20) | `src/workers/__tests__/ga4Pipeline.test.ts` |
| Seed script | `src/scripts/seedGa4TestData.ts` |
| Migration | `prisma/migrations/20260415072720_add_ga4_session_new_vs_returning/` |

### Klaviyo — Deliverables

| Deliverable | Location |
|---|---|
| Bug audit | `project-resources/klaviyo-audit.md` |
| Unit tests (53) | `src/transform/klaviyo/__tests__/` |
| Integration test (36) | `src/workers/__tests__/klaviyoPipeline.test.ts` |
| Seed script | `src/scripts/seedKlaviyoTestData.ts` |
| Migration | `prisma/migrations/…rename_klaviyo_event_campaign_id_to_message_id/` |

---

### Shopify — Deliverables

| Deliverable | Location |
|---|---|
| Bug audit | `project-resources/shopify-audit.md` |
| Unit tests (5 files) | `src/transform/shopify/__tests__/` |
| Integration test | `src/workers/__tests__/shopifyPipeline.test.ts` |
| Seed script | `src/scripts/seedShopifyTestData.ts` |
| Migration | `prisma/migrations/20260415131624_fix_shopify_audit_bugs/` |

### Cin7 — Deliverables

| Deliverable | Location |
|---|---|
| Bug audit | `project-resources/cin7-audit.md` |
| Unit tests (8 files, 217 tests) | `src/transform/cin7/__tests__/` |
| Integration test | `src/workers/__tests__/cin7Pipeline.test.ts` |
| Seed script | `src/scripts/seedCin7TestData.ts` |
| Migration | `prisma/migrations/…add_cin7_price_tiers_and_inventory_dimensions/` |

### Facebook — Deliverables

| Deliverable | Location |
|---|---|
| Bug audit | `project-resources/facebook-audit.md` |
| Unit tests (6 files, 120 tests) | `src/transform/facebook/__tests__/` |
| Integration test | `src/workers/__tests__/facebookPipeline.test.ts` |
| Seed script | `src/scripts/seedFacebookTestData.ts` |
| Migration | `prisma/migrations/…add_facebook_ad_insight_frequency/` |

---

## What Happens Next

All 5 platforms have been audited and completed.
