# Cin7 Memory Fix Plan

## Context

Cin7 is currently disabled (`CIN7_ENABLED=false`). Before enabling it, high-volume
jobs should be converted to the page-by-page pattern to avoid first-run memory spikes.

Cin7 uses REST pagination with page-number style (not cursor-based). Each page is 250
records. The adapter loops pages until a page returns fewer than 250 records (last page).

---

## Jobs That Need Fixing

| Job | First-Run Risk | Reason |
|---|---|---|
| ORDERS | HIGH | All orders + line items since account creation. Could be years of history |
| CONTACTS | MEDIUM-HIGH | Full contact/customer list |
| PURCHASE_ORDERS | MEDIUM | All purchase orders since account creation |
| CREDIT_NOTES | MEDIUM | All credit notes since account creation |
| STOCK_ADJUSTMENTS | MEDIUM | Full adjustment history |

Jobs that do NOT need fixing:

| Job | Reason Safe |
|---|---|
| PRODUCTS | Medium risk but incremental filter (`lastSyncedAt`) significantly limits first-run size |
| INVENTORY | Full snapshot but bounded by SKU count, not transaction history |
| BRANCHES | Very small — typically < 50 records |

---

## Files to Change

| File | Change |
|---|---|
| `src/adapters/cin7/orders.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/cin7/contacts.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/cin7/purchaseOrders.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/cin7/creditNotes.ts` | Add `onPage` callback, remove accumulator |
| `src/adapters/cin7/stockAdjustments.ts` | Add `onPage` callback, remove accumulator |
| `src/workers/cin7Worker.ts` | Update all 5 affected cases |

---

## How the Fix Works

Cin7 adapters use page-number pagination (page 1, 2, 3... until last page < 250 rows).
The fix follows the same onPage callback pattern as Klaviyo and Shopify.

**Current (bad for large datasets):**
```
fetchOrders(lastSyncedAt)
  → loop pages 1..N, accumulate all → return raw[]
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

Peak memory = 250 orders + their line items per page, regardless of total history.

---

## Special Note for Orders, Purchase Orders, Credit Notes

These jobs have nested line items. Both the parent record and its line items must be
upserted together per page in the callback — same pattern as Shopify orders.

---

## What Does NOT Change

- All `upsert*` functions in `cin7Repo.ts` — unchanged
- All transformer functions — unchanged
- 350ms `sleep` between pages in adapters — unchanged (Cin7 REST rate limiting)
- `ON DUPLICATE KEY UPDATE` on all tables — retries remain safe

---

## Regression Test Plan

After implementation:

1. `tsc --noEmit` — zero errors
2. Enable Cin7 temporarily: `CIN7_ENABLED=true` with valid credentials in `.env`
3. Trigger `cin7:branches` first (lowest risk) → confirm success in `sync_log`
4. Trigger `cin7:orders` → monitor memory via `docker stats` — should stay flat
5. Confirm `cin7_orders` + `cin7_order_line_items` row counts are correct
6. Trigger same job again — second run should have near-zero fetched (incremental)
7. Repeat for contacts, purchase orders, credit notes, stock adjustments
