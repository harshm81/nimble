import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                          */
/* ------------------------------------------------------------------ */

export interface OrderInput {
  shopifyId: string;
  orderName: string | null;
  customerEmail: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: number | null;
  subtotalPrice: number | null;
  totalTax: number | null;
  currency: string | null;
  orderDate: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface OrderLineItemInput {
  shopifyOrderId: string;
  shopifyLineItemId: string;
  name: string | null;
  sku: string | null;
  quantity: number | null;
  originalUnitPrice: number | null;
  discountedUnitPrice: number | null;
  totalDiscount: number | null;
  srcModifiedAt: Date | null;
  syncedAt: Date;
}

export interface RefundInput {
  shopifyOrderId: string;
  shopifyRefundId: string;
  refundedAt: Date | null;
  note: string | null;
  totalRefunded: number | null;
  syncedAt: Date;
}

export interface CustomerInput {
  shopifyId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface ProductInput {
  shopifyId: string;
  title: string | null;
  status: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface InventoryInput {
  shopifyId: string;
  available: number | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface CartEventInput {
  shopifyCartId: string;
  eventType: string;
  customerEmail: string | null;
  customerId: string | null;
  lineItemsCount: number | null;
  totalPrice: number | null;
  currency: string | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface ProductVariantInput {
  shopifyProductId: string;
  shopifyVariantId: string;
  title: string | null;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
  position: number | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Upsert functions                                                    */
/* ------------------------------------------------------------------ */

export async function upsertOrders(rows: OrderInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyId}, ${r.orderName}, ${r.customerEmail}, ${r.financialStatus}, ${r.fulfillmentStatus}, ${r.totalPrice}, ${r.subtotalPrice}, ${r.totalTax}, ${r.currency}, ${r.orderDate}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_orders (shopify_id, order_name, customer_email, financial_status, fulfillment_status, total_price, subtotal_price, total_tax, currency, order_date, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        order_name = VALUES(order_name),
        customer_email = VALUES(customer_email),
        financial_status = VALUES(financial_status),
        fulfillment_status = VALUES(fulfillment_status),
        total_price = VALUES(total_price),
        subtotal_price = VALUES(subtotal_price),
        total_tax = VALUES(total_tax),
        currency = VALUES(currency),
        order_date = VALUES(order_date),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertOrderLineItems(rows: OrderLineItemInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyOrderId}, ${r.shopifyLineItemId}, ${r.name}, ${r.sku}, ${r.quantity}, ${r.originalUnitPrice}, ${r.discountedUnitPrice}, ${r.totalDiscount}, ${r.srcModifiedAt}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_order_line_items (shopify_order_id, shopify_line_item_id, name, sku, quantity, original_unit_price, discounted_unit_price, total_discount, src_modified_at, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        sku = VALUES(sku),
        quantity = VALUES(quantity),
        original_unit_price = VALUES(original_unit_price),
        discounted_unit_price = VALUES(discounted_unit_price),
        total_discount = VALUES(total_discount),
        src_modified_at = VALUES(src_modified_at),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertRefunds(rows: RefundInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyOrderId}, ${r.shopifyRefundId}, ${r.refundedAt}, ${r.note}, ${r.totalRefunded}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_refunds (shopify_order_id, shopify_refund_id, refunded_at, note, total_refunded, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        refunded_at = VALUES(refunded_at),
        note = VALUES(note),
        total_refunded = VALUES(total_refunded),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertCustomers(rows: CustomerInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyId}, ${r.email}, ${r.firstName}, ${r.lastName}, ${r.phone}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_customers (shopify_id, email, first_name, last_name, phone, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        phone = VALUES(phone),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertProducts(rows: ProductInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyId}, ${r.title}, ${r.status}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_products (shopify_id, title, status, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        status = VALUES(status),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertInventory(rows: InventoryInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyId}, ${r.available}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_inventory (shopify_id, available, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        available = VALUES(available),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertProductVariants(rows: ProductVariantInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map((r) =>
        Prisma.sql`(${r.shopifyProductId}, ${r.shopifyVariantId}, ${r.title}, ${r.sku}, ${r.price}, ${r.compareAtPrice}, ${r.inventoryQuantity}, ${r.position}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`
      )
    );
    await prisma.$executeRaw`
      INSERT INTO shopify_product_variants (shopify_product_id, shopify_variant_id, title, sku, price, compare_at_price, inventory_quantity, position, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        sku = VALUES(sku),
        price = VALUES(price),
        compare_at_price = VALUES(compare_at_price),
        inventory_quantity = VALUES(inventory_quantity),
        position = VALUES(position),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data = VALUES(raw_data),
        synced_at = VALUES(synced_at)
    `;
    saved += c.length;
  }
  return saved;
}

export async function upsertCartEvent(row: CartEventInput): Promise<void> {
  // Unique key is (shopify_cart_id, event_type) — create and update are stored as separate rows.
  // ON DUPLICATE KEY UPDATE only fires when the same cart fires the same event type twice (retry).
  await prisma.$executeRaw`
    INSERT INTO shopify_cart_events (shopify_cart_id, event_type, customer_email, customer_id, line_items_count, total_price, currency, src_created_at, src_modified_at, raw_data, synced_at)
    VALUES (${row.shopifyCartId}, ${row.eventType}, ${row.customerEmail}, ${row.customerId}, ${row.lineItemsCount}, ${row.totalPrice}, ${row.currency}, ${row.srcCreatedAt}, ${row.srcModifiedAt}, ${JSON.stringify(row.rawData)}, ${row.syncedAt})
    ON DUPLICATE KEY UPDATE
      customer_email = VALUES(customer_email),
      customer_id = VALUES(customer_id),
      line_items_count = VALUES(line_items_count),
      total_price = VALUES(total_price),
      currency = VALUES(currency),
      src_modified_at = VALUES(src_modified_at),
      raw_data = VALUES(raw_data),
      synced_at = VALUES(synced_at)
  `;
}
