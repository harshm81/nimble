# Shopify Memory Fix Plan

## Context

Shopify is currently enabled (`SHOPIFY_ENABLED=true` in `.env`). Before any large
first-run sync or if the integration is reset, the ORDERS, CUSTOMERS, and PRODUCTS
jobs will load full paginated history into a single in-memory array before upserting.

This is the same accumulator problem as Klaviyo profiles/events. The fix is identical:
convert adapters to accept an `onPage` callback so the worker upserts each page as it
arrives instead of waiting for the full history.

---

## Jobs That Need Fixing

| Job | First-Run Risk | Reason |
|---|---|---|
| ORDERS | HIGH | All orders + line items + refunds in one array. GraphQL page size 250 |
| CUSTOMERS | MEDIUM-HIGH | All customers since account creation |
| PRODUCTS | MEDIUM-HIGH | All products + variants in one array |

Jobs that do NOT need fixing:

| Job | Reason Safe |
|---|---|
| INVENTORY | Full snapshot, lower total record count than orders |
| PRODUCT_VARIANTS | Triggered by PRODUCTS job — will be fixed when PRODUCTS is fixed |

---

## Files to Change

| File | Change |
|---|---|
| `src/adapters/shopify/orders.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/shopify/customers.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/shopify/products.ts` | Add `onPage` callback, remove accumulator |
| `src/workers/shopifyWorker.ts` | Update ORDERS, CUSTOMERS, PRODUCTS cases |

---

## How the Fix Works (same pattern as Klaviyo)

**Current (bad for large datasets):**
```
fetchOrders(lastSyncedAt)
  → accumulates ALL cursor pages → returns raw[]
worker:
  orders = raw.map(transformOrder)
  lineItems = raw.flatMap(transformLineItems)
  await upsertOrders(orders)
  await upsertOrderLineItems(lineItems)
```

**New:**
```
fetchOrders(lastSyncedAt, async (page) => {
  const orders = page.map(r => transformOrder(r, syncedAt));
  const lineItems = page.flatMap(r => transformOrderLineItems(r, syncedAt));
  await upsertOrders(orders);
  await upsertOrderLineItems(lineItems);
})
```

Peak memory = 250 orders + their line items (one GraphQL page), regardless of total
order history.

---

## Special Note for Products + Variants

The PRODUCTS job upserts products and their variants together in the worker.
Both must be processed per page together. The callback receives one page of products;
the worker extracts variants from that same page and upserts both before the next page.

The PRODUCT_VARIANTS job (triggered after PRODUCTS completes) also uses the same
adapter — it will automatically benefit from the same fix.

---

## What Does NOT Change

- `upsertOrders`, `upsertCustomers`, `upsertProducts`, `upsertOrderLineItems`,
  `upsertProductVariants` in `shopifyRepo.ts` — unchanged
- All transformer functions — unchanged
- `ON DUPLICATE KEY UPDATE` on all tables — retries remain safe

---

## Regression Test Plan

After implementation:

1. `tsc --noEmit` — zero errors
2. Trigger `shopify:orders` via Bull Board → confirm `sync_log` success
3. Confirm `shopify_orders` + `shopify_order_line_items` row counts correct
4. Run `docker stats` during sync — memory should stay flat, not spike
5. Trigger same job again — second run should be near-zero fetched (incremental cursor)
6. Repeat for `shopify:customers` and `shopify:products`
