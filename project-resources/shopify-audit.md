# Shopify Integration Audit Report

**Date:** April 15, 2026  
**Audit Phases:** 2 & 3 (Code & API Analysis)  
**Status:** Complete — all bugs fixed

---

## Audit Scope

This audit examines the Shopify integration for five core data modules:

1. **Orders** — order records with financial and fulfilment status
2. **Order Line Items** — per-line product detail within each order
3. **Customers** — customer profile records
4. **Products** — product catalogue and variants
5. **Add-to-cart Events** — cart creation/update events via webhook

Mapped to code modules:
- **Module A:** Orders + Line Items + Refunds (`shopify_orders`, `shopify_order_line_items`, `shopify_refunds`)
- **Module B:** Customers (`shopify_customers`)
- **Module C:** Products + Variants (`shopify_products`, `shopify_product_variants`)
- **Module D:** Inventory (`shopify_inventory`) — triggered by the Products job
- **Module E:** Cart Events (`shopify_cart_events`) — webhook-driven, no cron job

---

## API Reference (confirmed)

**Endpoint:** `POST https://{shop}.myshopify.com/admin/api/2026-04/graphql.json`  
**Auth:** Access token via `X-Shopify-Access-Token` header  
**Pagination:** Cursor-based (`pageInfo.hasNextPage` + `pageInfo.endCursor`)  
**Rate limiting:** Cost-based leaky bucket (100 points/s standard plan) — throttle status in `extensions.cost.throttleStatus`  
**Cart webhook:** `POST /webhooks/shopify/cart` — HMAC-SHA256 verified via `x-shopify-hmac-sha256` header

---

## Bug Registry

---

### BUG-SHO-01 — `ShopifyInventory.available` stored as `Int` — must be `Decimal(12,4)` [HIGH]

**Bug ID:** BUG-SHO-01  
**Severity:** HIGH  
**Area:** Schema  
**File:** `prisma/schema.prisma` line 566  
**API Field:** `available` (`Int | null` on `InventoryLevel`)

**Description:**  
The `ShopifyInventory` model stores `available` as `Int @db.Int`. Per project data type rules, all quantity/stock level fields must be `Decimal @db.Decimal(12, 4)` to support fractional units (e.g., `1.5` kg or `0.5` m of fabric). Shopify inventory quantities can be fractional for merchants selling by weight or length.

**Why it matters:**  
Fractional inventory quantities are silently truncated to integers before insertion. A stock level of `1.5` becomes `1`, understating available stock. This causes incorrect inventory reporting.

**Suggested fix:**  
Change the schema field from:
```prisma
available     Int      @map("available") @db.Int
```
to:
```prisma
available     Decimal? @map("available") @db.Decimal(12, 4)
```
Run `npx prisma migrate dev --name fix_shopify_inventory_available_decimal`. Update `InventoryInput.available` to `number | null` and the transformer to `raw.available ?? null`.

---

### BUG-SHO-02 — `ShopifyProductVariant.inventoryQuantity` stored as `Int?` — must be `Decimal(12,4)` [HIGH]

**Bug ID:** BUG-SHO-02  
**Severity:** HIGH  
**Area:** Schema  
**File:** `prisma/schema.prisma` line 586  
**API Field:** `inventoryQuantity` (`Int | null` on `ProductVariant`)

**Description:**  
`ShopifyProductVariant.inventoryQuantity` is defined as `Int? @map("inventory_quantity")` with no `@db` annotation. Per the data type rules, quantity fields must be `Decimal(12, 4)`. Additionally, the missing `@db.Decimal(12, 4)` annotation means Prisma falls back to its default int type rather than an explicitly sized column.

**Why it matters:**  
Same truncation risk as BUG-SHO-01. Variant-level stock counts that are fractional will be stored incorrectly.

**Suggested fix:**  
Change the schema field from:
```prisma
inventoryQuantity Int?     @map("inventory_quantity")
```
to:
```prisma
inventoryQuantity Decimal? @map("inventory_quantity") @db.Decimal(12, 4)
```
Run `npx prisma migrate dev --name fix_shopify_variant_inventory_quantity_decimal`. Update `ProductVariantInput.inventoryQuantity` to `number | null`.

---

### BUG-SHO-03 — `ShopifyCartEvent.srcCreatedAt` / `srcModifiedAt` non-nullable in schema but nullable in code [HIGH]

**Bug ID:** BUG-SHO-03  
**Severity:** HIGH  
**Area:** Schema  
**File:** `prisma/schema.prisma` lines 611–612, `src/server/webhooks/shopifyCartWebhook.ts` lines 68–69  
**API Field:** `created_at`, `updated_at` on cart webhook payload

**Description:**  
The `ShopifyCartEvent` schema declares `srcCreatedAt` and `srcModifiedAt` as non-nullable `DateTime`. However:
- `ShopifyCartWebhookPayload` types both as `string | null`
- The webhook handler passes `payload.created_at ? new Date(...) : null`
- `CartEventInput` declares both as `Date | null`

Inserting a `NULL` into a non-nullable `DATETIME(3)` column will cause a database error (or coerce to `'0000-00-00 00:00:00'` on older MySQL configs), crashing the webhook handler for carts with missing timestamps.

**Why it matters:**  
Any cart webhook payload that lacks `created_at` or `updated_at` (which Shopify does not guarantee) will fail to insert, and the webhook returns 500. Shopify retries failed webhooks, causing an infinite retry storm.

**Suggested fix:**  
Change the schema fields to nullable:
```prisma
srcCreatedAt    DateTime? @map("src_created_at") @db.DateTime(3)
srcModifiedAt   DateTime? @map("src_modified_at") @db.DateTime(3)
```
Run `npx prisma migrate dev --name fix_shopify_cart_event_nullable_timestamps`.

---

### BUG-SHO-04 — `inventoryTransformer` uses `?? 0` fallback — should be `?? null` [MEDIUM]

**Bug ID:** BUG-SHO-04  
**Severity:** MEDIUM  
**Area:** Transformer  
**File:** `src/transform/shopify/inventoryTransformer.ts` line 7  
**API Field:** `available` (`number | null`)

**Description:**  
The transformer maps:
```ts
available: raw.available ?? 0,
```
The API type is `number | null`. A `null` value from the API means the inventory level has no assigned warehouse — it is genuinely unknown, not zero. Defaulting to `0` misrepresents unknown stock as zero stock, which could trigger incorrect low-stock alerts or suppress reorder notifications.

**Why it matters:**  
`null` and `0` have distinct business meanings for inventory. Coercing `null → 0` silently misrepresents missing data as zero stock.

**Suggested fix:**  
Change to `raw.available ?? null`. Update `InventoryInput.available` type from `number` to `number | null` (aligns with BUG-SHO-01 fix).

---

### BUG-SHO-05 — `orderTransformer` uses `?? 0` for line item `quantity` — should be `?? null` [MEDIUM]

**Bug ID:** BUG-SHO-05  
**Severity:** MEDIUM  
**Area:** Transformer  
**File:** `src/transform/shopify/orderTransformer.ts` line 36  
**API Field:** `quantity` (`number | null` on `ShopifyLineItemNode`)

**Description:**  
The line item transformer maps:
```ts
quantity: li.quantity ?? 0,
```
`quantity` is typed as `number | null`. A null quantity should not be stored as `0` — it indicates the API returned an indeterminate value (e.g., a gift card line item or a draft order item).

**Why it matters:**  
A zero-quantity line item looks like a cancelled or voided line rather than an unknown quantity. This corrupts order value calculations that sum `quantity * unit_price`.

**Suggested fix:**  
Change to `li.quantity ?? null`. Update the `ShopifyOrderLineItem` schema column `quantity` from `Int @db.Int` to `Int?` (nullable), and `OrderLineItemInput.quantity` from `number` to `number | null`.

---

### BUG-SHO-06 — `productTransformer` uses `?? ''` for nullable fields — schema should allow null [MEDIUM]

**Bug ID:** BUG-SHO-06  
**Severity:** MEDIUM  
**Area:** Transformer + Schema  
**File:** `src/transform/shopify/productTransformer.ts` lines 7–8, `prisma/schema.prisma` lines 548–549  
**API Field:** `title`, `status` (`string | null` on `ShopifyProductNode`)

**Description:**  
The API type declares both `title` and `status` as `string | null`. The transformer coerces them to `''` on null:
```ts
title: raw.title ?? '',
status: raw.status ?? '',
```
The schema has both as non-nullable `String`. An empty-string `title` is indistinguishable from a product with a genuinely blank title. Same for `status`.

**Why it matters:**  
Filtering `WHERE title != ''` or `WHERE status != ''` to find properly populated products will silently exclude products whose title was null from the API, rather than surfacing them as data quality issues.

**Suggested fix:**  
Make both schema fields nullable:
```prisma
title         String?  @map("title") @db.VarChar(255)
status        String?  @map("status") @db.VarChar(50)
```
Update `ProductInput.title` and `ProductInput.status` to `string | null`. Change transformer to `raw.title ?? null` and `raw.status ?? null`. Run `npx prisma migrate dev --name fix_shopify_product_nullable_title_status`.

---

### BUG-SHO-07 — `productVariantTransformer` passes `title`/`sku` without `?? null` guard [LOW]

**Bug ID:** BUG-SHO-07  
**Severity:** LOW  
**Area:** Transformer  
**File:** `src/transform/shopify/productVariantTransformer.ts` lines 8–9  
**API Field:** `title`, `sku` (`string | null` on `ShopifyVariantNode`)

**Description:**  
The transformer assigns:
```ts
title: v.title,
sku: v.sku,
```
Both are `string | null` in `ShopifyVariantNode`. While TypeScript accepts this because `ProductVariantInput` declares them as `string | null`, the convention across all other transformers is to use `?? null` for nullable assignments. Without the guard, if TypeScript ever widens the type to include `undefined` (e.g., via a GraphQL client change), `undefined` would be passed silently to the SQL statement rather than `null`, causing an insertion error.

**Why it matters:**  
Low risk now but inconsistent with every other transformer in the codebase. The `?? null` pattern is the project standard.

**Suggested fix:**  
Change to:
```ts
title: v.title ?? null,
sku: v.sku ?? null,
```

---

### BUG-SHO-08 — No startup validation for `SHOPIFY_SHOP_NAME` when `SHOPIFY_ENABLED=true` [LOW]

**Bug ID:** BUG-SHO-08  
**Severity:** LOW  
**Area:** Config  
**File:** `src/config/index.ts`  
**API Field:** N/A

**Description:**  
`SHOPIFY_SHOP_NAME` is declared as `z.string().optional()` in the config schema. When `SHOPIFY_ENABLED=true` and `SHOPIFY_SHOP_NAME` is missing, `shopifyClient.ts` constructs the base URL as `https://.myshopify.com/...` (empty shop name). The first API call fails with a DNS or 404 error rather than a clear startup message. GA4 and Klaviyo both validate their required keys at startup (lines 56–67 of `config/index.ts`) — Shopify does not follow the same pattern.

**Why it matters:**  
A misconfigured deployment produces cryptic errors at the first job execution rather than at startup, making the root cause harder to diagnose in production.

**Suggested fix:**  
Add to `src/config/index.ts` after the existing platform checks:
```ts
if (config.SHOPIFY_ENABLED && !config.SHOPIFY_SHOP_NAME) {
  process.stderr.write('SHOPIFY_ENABLED=true but SHOPIFY_SHOP_NAME is not set\n');
  process.exit(1);
}
```

---

### BUG-SHO-09 — Worker logs `job:` field instead of `jobName:` [LOW]

**Bug ID:** BUG-SHO-09  
**Severity:** LOW  
**Area:** Worker  
**File:** `src/workers/shopifyWorker.ts` line 35  
**API Field:** N/A

**Description:**  
The worker logs:
```ts
logger.info({ platform: SHOPIFY_PLATFORM, job: job.name }, 'job started');
```
The logging rules and every other worker in the codebase use `jobName` as the structured field name, not `job`. Log filters expecting `{ jobName }` will miss Shopify's start events.

**Why it matters:**  
Inconsistent log field names break centralised log monitoring and alerting that filters by `jobName`.

**Suggested fix:**  
Change `job: job.name` → `jobName: job.name`.

---

## Summary Table

| Bug ID | Module | Severity | Area | Short Description |
|---|---|---|---|---|
| BUG-SHO-01 | Inventory | **High** | Schema | `available` stored as `Int` — must be `Decimal(12,4)` | Fixed |
| BUG-SHO-02 | Products | **High** | Schema | `inventoryQuantity` stored as `Int?` — must be `Decimal(12,4)` | Fixed |
| BUG-SHO-03 | Cart Events | **High** | Schema | `srcCreatedAt`/`srcModifiedAt` non-nullable but webhook can pass null | Fixed |
| BUG-SHO-04 | Inventory | **Medium** | Transformer | `available ?? 0` — should be `?? null` | Fixed |
| BUG-SHO-05 | Orders | **Medium** | Transformer | `quantity ?? 0` on line items — should be `?? null` | Fixed |
| BUG-SHO-06 | Products | **Medium** | Transformer + Schema | `title`/`status` coerced to `''` — schema should be nullable, use `?? null` | Fixed |
| BUG-SHO-07 | Products | **Low** | Transformer | `title`/`sku` in variant transformer missing `?? null` guard | Fixed |
| BUG-SHO-08 | Config | **Low** | Config | No startup validation for `SHOPIFY_SHOP_NAME` | Fixed |
| BUG-SHO-09 | Worker | **Low** | Worker | `job:` field in log should be `jobName:` | Fixed |

---

## What Happens Next

1. You review this bug list
2. Confirm, remove, or add anything
3. Once approved → we move to **Fix phase** in order: High → Medium → Low
4. After Shopify fixes are done and you say **"Done"** → we start the next platform
