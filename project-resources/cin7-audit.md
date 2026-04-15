# Cin7 Platform Audit

**Date:** 2026-04-15
**Modules audited:** Sales Orders, Order Line Items, Customers (Contacts), Products, Inventory, Purchase Orders, Returns/Refunds (Credit Notes), Stock Adjustments

---

## Bug List

---

### BUG-CIN7-01

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-01 |
| **Severity** | High |
| **Area** | Transformer + API Types |
| **File** | `src/transform/cin7/orderTransformer.ts` line 15, `src/types/cin7.types.ts` |
| **API Endpoint** | `GET /v1/SalesOrders` |
| **API Field** | `paymentTerms` |
| **Description** | `Cin7SalesOrder` type is missing the `paymentTerms` field entirely. The transformer compensates by reading `raw.priceTier` into the `paymentTerms` DB column — storing the customer's price tier name (e.g. `"Retail"`) in a column that should hold payment terms (e.g. `"Net 30"`). |
| **Why it matters** | Every order in the DB has a wrong value in `payment_terms`: the column will contain price tier names instead of actual payment terms. Any downstream report using `payment_terms` will produce wrong data silently. |
| **Suggested fix** | Add `paymentTerms: string \| null` to `Cin7SalesOrder`. Update `transformOrder` to read `raw.paymentTerms ?? null`. |

---

### BUG-CIN7-02

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-02 |
| **Severity** | High |
| **Area** | Transformer + Schema + Repo |
| **File** | `src/transform/cin7/productTransformer.ts`, `src/db/repositories/cin7Repo.ts`, `prisma/schema.prisma` |
| **API Endpoint** | `GET /v1/Products` |
| **API Field** | `unitPriceTier2`, `unitPriceTier3`, `unitPriceTier4`, `unitPriceTier5`, `unitPriceTier6`, `unitPriceTier7`, `unitPriceTier8`, `unitPriceTier9`, `unitPriceTier10` |
| **Description** | The Cin7 API returns 9 additional price tiers (`unitPriceTier2`–`unitPriceTier10`) per product. These fields exist in `Cin7Product` (types file lines 134–142) but are not mapped in `ProductInput`, not inserted in `upsertProducts`, and have no columns in the `cin7_products` table. All 9 price tiers are silently discarded on every sync. |
| **Why it matters** | Cin7 customers use price tiers to set different prices for different customer groups (wholesale, retail, VIP, etc.). These pricing tiers are a core Cin7 feature. Storing only `unitPrice` means the DB cannot answer any question about tiered pricing. |
| **Suggested fix** | Add columns `unit_price_tier2` through `unit_price_tier10` (`Decimal? @db.Decimal(12,4)`) to `Cin7Product` in the schema. Add corresponding fields to `ProductInput`. Map all 9 tiers in `transformProduct`. |

---

### BUG-CIN7-03

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-03 |
| **Severity** | High |
| **Area** | Transformer + Schema + Repo |
| **File** | `src/transform/cin7/inventoryTransformer.ts`, `src/db/repositories/cin7Repo.ts`, `prisma/schema.prisma` |
| **API Endpoint** | `GET /v1/Stock` |
| **API Field** | `weight`, `cbm`, `height`, `width`, `depth` |
| **Description** | `Cin7StockItem` (types file lines 171–175) includes `weight`, `cbm`, `height`, `width`, `depth` from the Stock API response. None of these fields appear in `InventoryInput` or `inventoryTransformer.ts`. The `cin7_inventory` table has no columns for them. All 5 physical dimension fields are silently discarded on every inventory sync. |
| **Why it matters** | Weight and dimensions are used for shipping calculations and 3PL integrations. If inventory dimensions are fetched from Cin7 but never stored, any shipping cost estimate or warehouse management integration that queries `cin7_inventory` for these values will find NULL. |
| **Suggested fix** | Add `weight`, `cbm`, `height`, `width`, `depth` (`Decimal? @db.Decimal(10,4)`) to `Cin7Inventory` in the schema. Add corresponding fields to `InventoryInput`. Map them in `transformInventory`. |

---

### BUG-CIN7-04

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-04 |
| **Severity** | High |
| **Area** | API Types |
| **File** | `src/types/cin7.types.ts` |
| **API Endpoint** | `GET /v1/SalesOrders`, `GET /v1/Contacts`, `GET /v1/PurchaseOrders`, `GET /v1/CreditNotes`, `GET /v1/Adjustments` |
| **API Field** | `modifiedDate` |
| **Description** | The Cin7 API returns the modification timestamp as `modifiedDate` (confirmed in API docs for all resources). The TypeScript interfaces (`Cin7SalesOrder`, `Cin7Contact`, `Cin7PurchaseOrder`, `Cin7CreditNote`, `Cin7StockAdjustment`) all declare this field as `updatedDate`. At runtime, `r.updatedDate` will always be `undefined` because the API never sends a field by that name. The worker cursor reduction (`raw.reduce((max, r) => r.updatedDate ? ... : max, null)`) will always return `null`, causing `setLastSyncedAt` to store the wall-clock `syncedAt` instead of the actual latest source timestamp. |
| **Why it matters** | The incremental sync cursor is silently broken for all 5 modules. On every run, `lastSyncedAt` advances to wall-clock time instead of the latest `modifiedDate` in the fetched data. This means: (a) on the next run the `where modifiedDate >= ...` filter will exclude records that were modified between the last `modifiedDate` and the wall-clock `syncedAt`, causing data gaps; or (b) on the first run (where `lastSyncedAt` is null) this is masked, but any re-sync after that will miss records. |
| **Suggested fix** | Rename `updatedDate` to `modifiedDate` in all 5 affected interfaces (`Cin7SalesOrder`, `Cin7Contact`, `Cin7PurchaseOrder`, `Cin7CreditNote`, `Cin7StockAdjustment`). Update all transformer calls from `raw.updatedDate` to `raw.modifiedDate`. Update worker cursor reductions from `r.updatedDate` to `r.modifiedDate`. |

---

### BUG-CIN7-05

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-05 |
| **Severity** | Medium |
| **Area** | Worker |
| **File** | `src/workers/cin7Worker.ts` line 46 |
| **API Endpoint** | N/A |
| **API Field** | N/A |
| **Description** | The worker logs `{ platform, job: job.name }` instead of `{ platform, jobName: job.name }`. The logging rules (`.claude/rules/logging.md`) require `jobName` as the structured field for log filtering. Every other platform worker uses `jobName`. |
| **Why it matters** | Log queries filtering on `jobName` field will miss all Cin7 worker log lines. Observability is degraded — you cannot use the standard log filter to see what Cin7 jobs are running. |
| **Suggested fix** | Change `job: job.name` to `jobName: job.name` on line 46. |

---

### BUG-CIN7-06

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-06 |
| **Severity** | Medium |
| **Area** | Config |
| **File** | `src/config/index.ts` |
| **API Endpoint** | N/A |
| **API Field** | N/A |
| **Description** | There is no startup validation for `CIN7_API_USERNAME` or `CIN7_API_KEY` when `CIN7_ENABLED=true`. GA4, Klaviyo, Shopify, and Facebook all have equivalent fail-fast guards. Cin7 is the only enabled platform that does not. If credentials are missing, the process starts successfully but every Cin7 job fails at the first API call with an auth error, leaving failed jobs accumulating in BullMQ with no clear startup signal. |
| **Why it matters** | Deployment misconfiguration (missing credentials) is silent. The operator has no way to know the credentials are missing until the first job runs and fails. Fail-fast at startup is the established pattern across all other platforms. |
| **Suggested fix** | Add after the existing guards in `src/config/index.ts`: `if (config.CIN7_ENABLED && !config.CIN7_API_USERNAME) { ... process.exit(1); }` and the equivalent for `CIN7_API_KEY`. |

---

### BUG-CIN7-07

| Field | Value |
|---|---|
| **Bug ID** | BUG-CIN7-07 |
| **Severity** | Low |
| **Area** | Transformer |
| **File** | `src/transform/cin7/orderTransformer.ts` line 15 (pre-fix for BUG-CIN7-01) |
| **API Endpoint** | `GET /v1/SalesOrders` |
| **API Field** | `paymentTerms` |
| **Description** | Dependent on BUG-CIN7-01. The `Cin7SalesOrder` type is also missing `invoiceNumber` as an integer — the type declares `invoiceNumber: string | null` (line 40) but the Cin7 API returns it as an integer. Storing an integer in a `VarChar(100)` column is harmless from a DB perspective but means the code cannot perform integer operations on it. |
| **Why it matters** | Low impact — the value is stored and readable, just typed incorrectly. |
| **Suggested fix** | Change `invoiceNumber: string \| null` to `invoiceNumber: number \| null` in `Cin7SalesOrder`. |

---

## Summary Table

| Bug ID | Severity | Module(s) | Area | Short Description |
|---|---|---|---|---|
| BUG-CIN7-01 | **High** | Sales Orders | Transformer + Types | `paymentTerms` field missing from type; transformer reads `priceTier` instead |
| BUG-CIN7-02 | **High** | Products | Transformer + Schema + Repo | 9 price tiers (`unitPriceTier2`–`unitPriceTier10`) silently dropped |
| BUG-CIN7-03 | **High** | Inventory | Transformer + Schema + Repo | 5 dimension fields (`weight`, `cbm`, `height`, `width`, `depth`) silently dropped |
| BUG-CIN7-04 | **High** | All incremental modules | API Types | `updatedDate` vs `modifiedDate` — cursor never advances from source timestamp |
| BUG-CIN7-05 | **Medium** | Worker | Worker | `job:` should be `jobName:` in structured log |
| BUG-CIN7-06 | **Medium** | Config | Config | No startup validation for `CIN7_API_USERNAME`/`CIN7_API_KEY` |
| BUG-CIN7-07 | **Low** | Sales Orders | API Types | `invoiceNumber` typed as `string` but API returns `number` |

---

## Files to Modify (when fixes are approved)

| File | Bugs |
|---|---|
| `src/types/cin7.types.ts` | BUG-CIN7-01, BUG-CIN7-04, BUG-CIN7-07 |
| `src/transform/cin7/orderTransformer.ts` | BUG-CIN7-01 |
| `src/transform/cin7/productTransformer.ts` | BUG-CIN7-02 |
| `src/transform/cin7/inventoryTransformer.ts` | BUG-CIN7-03 |
| `src/db/repositories/cin7Repo.ts` | BUG-CIN7-02, BUG-CIN7-03 |
| `prisma/schema.prisma` | BUG-CIN7-02, BUG-CIN7-03 |
| `src/workers/cin7Worker.ts` | BUG-CIN7-04 (cursor reductions), BUG-CIN7-05 |
| `src/config/index.ts` | BUG-CIN7-06 |

---

## Migrations Required (after schema changes)

```bash
npx prisma migrate dev --name add_cin7_product_price_tiers
npx prisma migrate dev --name add_cin7_inventory_dimensions
```

(These can be combined into one migration if applied together.)

---

## Status

**Phase 5 — Awaiting user review of bug list.**
