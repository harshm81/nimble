# Phase 3 — Shopify Integration
**Status:** ✅ Complete  
**API Version:** `2026-04` (latest stable, supported until April 1 2027)  
**Depends on:** Phase 1 complete (scaffold running, all tables created)

---

## Goal

Shopify data syncing end-to-end into MySQL covering all required modules:

| Module | Method | Schedule |
|---|---|---|
| Orders + Line Items + Refunds | GraphQL polling | Every 15 min |
| Customers | GraphQL polling | Every hour at :25 |
| Products + Variants | GraphQL polling | Every hour at :30 |
| Inventory | GraphQL polling | Triggered after products job |
| Add-to-Cart Events | Webhook (`carts/create`, `carts/update`) | Real-time |

---

## Add-to-Cart Events — Critical Limitation

**There is no polling API for cart events in Shopify.** No "list all carts" endpoint exists.

The only server-side option is webhooks:

| Topic | Fires When | Channel |
|---|---|---|
| `carts/create` | Cart created | **Online Store only** |
| `carts/update` | Item added / removed / qty changed | **Online Store only** |

- If Nimble Activewear uses a **headless/custom storefront** (Storefront API), these webhooks will NOT fire
- **Historical backfill is not possible** — only captures events from webhook registration date forward
- HMAC verification is **skipped in `development`** (`NODE_ENV=development`) for local Postman testing
- HMAC verification is **fully enforced in `production`** (`NODE_ENV=production`)

---

## Environment Variables

```env
SHOPIFY_SHOP_NAME=nimble-3
SHOPIFY_CLIENT_ID=c8bd290411ed4e3baeac7bd8fbc07b11
SHOPIFY_CLIENT_SECRET=5a203991a4a60f038cdebaf35ffe57dd
SHOPIFY_WEBHOOK_SECRET=605406529820806362644a803af64b94
```

`SHOPIFY_WEBHOOK_SECRET` is the signing secret shown in:  
Shopify Admin → Settings → Notifications → Webhooks → *"Your webhooks will be signed with..."*

---

## Database Tables

| Table | Populated By | Method |
|---|---|---|
| `shopify_orders` | `shopify:orders` job | Polling, incremental |
| `shopify_order_line_items` | `shopify:orders` job (nested) | Same job as orders |
| `shopify_refunds` | `shopify:orders` job (nested) | Same job as orders |
| `shopify_customers` | `shopify:customers` job | Polling, incremental |
| `shopify_products` | `shopify:products` job | Polling, incremental |
| `shopify_product_variants` | `shopify:product-variants` job (nested) | Triggered after products |
| `shopify_inventory` | `shopify:inventory` job | Triggered after products, full refresh |
| `shopify_cart_events` | `POST /webhooks/shopify/cart` | Real-time webhook |

---

## File Structure

```
src/constants/shopify.ts
src/types/shopify.types.ts

src/adapters/shopify/
  shopifyClient.ts
  orders.ts
  customers.ts
  products.ts                     ← variants(first: 100) nested in GraphQL query
  inventory.ts

src/transform/shopify/
  orderTransformer.ts             ← transformOrder, transformOrderLineItems, transformRefunds
  customerTransformer.ts
  productTransformer.ts
  productVariantTransformer.ts    ← transformProductVariants (returns ProductVariantInput[])
  inventoryTransformer.ts

src/db/repositories/shopifyRepo.ts
  Interfaces: OrderInput, OrderLineItemInput, RefundInput,
              CustomerInput, ProductInput, ProductVariantInput,
              InventoryInput, CartEventInput
  Functions:  upsertOrders, upsertOrderLineItems, upsertRefunds,
              upsertCustomers, upsertProducts, upsertProductVariants,
              upsertInventory, upsertCartEvent

src/workers/shopifyWorker.ts
src/server/app.ts                 ← raw body capture + webhook router mounted before JSON parser
src/server/webhooks/
  shopifyCartWebhook.ts           ← POST /webhooks/shopify/cart
src/queue/scheduler.ts            ← shopify cron entries
```

---

## Constants

```ts
// src/constants/shopify.ts
export const SHOPIFY_PLATFORM    = 'shopify';
export const SHOPIFY_QUEUE       = 'shopify';
export const SHOPIFY_API_VERSION = '2026-04';

export const SHOPIFY_BASE_URL = (shop: string) =>
  `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

export const SHOPIFY_JOBS = {
  ORDERS:           'shopify:orders',
  CUSTOMERS:        'shopify:customers',
  PRODUCTS:         'shopify:products',
  INVENTORY:        'shopify:inventory',
  PRODUCT_VARIANTS: 'shopify:product-variants',
} as const;
```

---

## Job Schedule

| Job constant | Cron | Trigger |
|---|---|---|
| `SHOPIFY_JOBS.ORDERS` | `*/15 * * * *` | Cron |
| `SHOPIFY_JOBS.CUSTOMERS` | `25 * * * *` | Cron |
| `SHOPIFY_JOBS.PRODUCTS` | `30 * * * *` | Cron |
| `SHOPIFY_JOBS.PRODUCT_VARIANTS` | — | Enqueued by products job after completion |
| `SHOPIFY_JOBS.INVENTORY` | — | Enqueued by products job after completion |

Cart events have no scheduler entry — they are received in real time via webhook.

---

## Authentication

Shopify uses OAuth access tokens (24-hour TTL). Token is fetched once per adapter call via `getAuthHeaders(SHOPIFY_PLATFORM)` from `tokenManager.ts`, and reused across all pagination pages within that call.

- Token stored in `platform_tokens` DB table
- Auto-refreshed when expiring within 5 minutes
- On 401: log error + re-throw — BullMQ handles retry

---

## Webhook Setup (Shopify Admin)

**Location:** Shopify Admin → Settings → Notifications → Webhooks

Register 2 webhooks:

| # | Event | Format | URL | API Version |
|---|---|---|---|---|
| 1 | Cart creation | JSON | `https://<your-domain>/webhooks/shopify/cart` | `2026-04` |
| 2 | Cart update | JSON | `https://<your-domain>/webhooks/shopify/cart` | `2026-04` |

Both point to the **same URL**. The route distinguishes them via `x-shopify-topic` header (`carts/create` vs `carts/update`).

After saving each webhook, click **"Send test notification"** to verify the endpoint receives it.

### Local Testing via Postman

Since Shopify cannot reach `localhost`, test locally with Postman:

**Method:** `POST`  
**URL:** `http://localhost:3000/webhooks/shopify/cart`

**Headers:**
| Key | Value |
|---|---|
| `x-shopify-topic` | `carts/update` |
| `Content-Type` | `application/json` |

> No `x-shopify-hmac-sha256` header needed in development — HMAC is skipped when `NODE_ENV=development`

**Body (raw → JSON):**
```json
{
  "id": "hWNAywB2XktPbMlGLxzStanY",
  "token": "hWNAywB2XktPbMlGLxzStanY",
  "line_items": [
    {
      "id": 62533210603891,
      "properties": null,
      "quantity": 1,
      "variant_id": 62533210603891,
      "discounted_price": "149.00",
      "discounts": [],
      "gift_card": false,
      "grams": 0,
      "line_price": "149.00"
    }
  ],
  "email": null,
  "currency": "AUD",
  "total_price": "149.00",
  "created_at": "2026-04-13T17:27:54Z",
  "updated_at": "2026-04-13T17:27:54Z"
}
```

**Expected response:** `{ "received": true }`

---

## Rate Limiting

Shopify GraphQL uses a leaky-bucket model. The client reads `x-shopify-shop-api-call-limit` after every response:

```
x-shopify-shop-api-call-limit: 320/1000
```

If remaining < 200, sleeps 10 seconds before next request. No fixed `sleep()` used — throttling is entirely header-based.

---

## Pagination

All GraphQL adapters use cursor-based pagination:

| Setting | Value |
|---|---|
| Page size | `first: 250` |
| Cursor | `after: $cursor` from `pageInfo.endCursor` |
| Terminal condition | `pageInfo.hasNextPage === false` |

Products adapter also fetches `variants(first: 100)` nested within each product page — no separate API call for variants.

---

## Incremental Sync

All polling jobs (except inventory) use `lastSyncedAt` from `sync_config`:

```
updated_at:>2026-04-13T00:00:00.000Z
```

- `setLastSyncedAt` is always called **before** `logSuccess`
- Inventory is always a full refresh — no incremental filter available on the inventory API
- `PRODUCT_VARIANTS` uses the same `lastSyncedAt` as `PRODUCTS` (re-fetches products, extracts variants)

---

## Verification

```sql
-- 1. All shopify tables populated
SELECT COUNT(*) FROM shopify_orders;
SELECT COUNT(*) FROM shopify_order_line_items;
SELECT COUNT(*) FROM shopify_refunds;
SELECT COUNT(*) FROM shopify_customers;
SELECT COUNT(*) FROM shopify_products;
SELECT COUNT(*) FROM shopify_product_variants;
SELECT COUNT(*) FROM shopify_inventory;
SELECT COUNT(*) FROM shopify_cart_events;   -- only after webhook fires

-- 2. Sync jobs completed successfully
SELECT platform, job_type, status, records_fetched, records_saved, duration_ms
FROM sync_logs
WHERE platform = 'shopify'
ORDER BY created_at DESC LIMIT 20;

-- 3. Incremental cursor is set
SELECT platform, job_type, last_synced_at
FROM sync_config
WHERE platform = 'shopify';

-- 4. Cart events received
SELECT shopify_cart_id, event_type, customer_email, line_items_count, total_price, currency
FROM shopify_cart_events
ORDER BY created_at DESC LIMIT 10;

-- 5. Variants linked to products
SELECT p.title, COUNT(v.id) AS variant_count
FROM shopify_products p
LEFT JOIN shopify_product_variants v ON v.shopify_product_id = p.shopify_id
GROUP BY p.shopify_id, p.title
LIMIT 20;
```

---

## Done Criteria

### Polling Jobs
- [x] `shopify_orders` populated after first sync
- [x] `shopify_order_line_items` populated (nested in orders)
- [x] `shopify_refunds` populated (nested in orders)
- [x] `shopify_customers` populated
- [x] `shopify_products` populated
- [x] `shopify_product_variants` populated (triggered after products job)
- [x] `shopify_inventory` populated (triggered after products job)
- [x] `sync_logs` shows `status='success'` for all polling jobs
- [x] `sync_config.last_synced_at` updated for all polling job types
- [x] Second sync fetches only new/updated records (incremental working)
- [x] All transformers have explicit `: *Input` return types
- [x] No inline `sleep` or `chunk` — imported from `src/utils/`
- [x] No hardcoded platform/queue/job strings — all from `src/constants/shopify.ts`

### Cart Event Webhooks
- [x] `SHOPIFY_WEBHOOK_SECRET` set in `.env`
- [x] HMAC verification enforced in production, bypassed in development
- [x] `POST /webhooks/shopify/cart` endpoint live
- [x] Postman test returns `{ "received": true }` and inserts row into `shopify_cart_events`
- [ ] Both webhooks registered in Shopify Admin (carts/create + carts/update) pointing to production URL
- [ ] Live test notification from Shopify received and stored

---

## What Is NOT Implemented (and Why)

| Feature | Reason |
|---|---|
| Add-to-cart browser pixel events | Requires custom JS pixel deployed on storefront — not a backend task |
| Abandoned checkouts | Removed — redundant with cart webhooks; carts/update covers the same funnel |
| Checkout webhooks (`checkouts/create`, `checkouts/update`) | Not in current scope — can be added if full checkout funnel data is needed |
| Fulfillments / shipment tracking | Not in scope for Phase 3 |
| Customer addresses | Not in scope for Phase 3 |
| Discounts / promo codes | Not in scope for Phase 3 |
