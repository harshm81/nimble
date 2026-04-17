/**
 * Shopify pipeline integration test.
 *
 * Tests the full data flow: fixtures → transformers → repos → real DB.
 * The Shopify adapters are not called (no real API key needed).
 * All other layers — transformers, repos, DB — run for real.
 *
 * Fixture shapes match the Shopify GraphQL Admin API 2026-04:
 *   https://shopify.dev/docs/api/admin-graphql
 *
 * What this test guarantees:
 *   - All 6 tables receive rows with the correct field values.
 *   - Upsert is idempotent: running the same fixtures twice does not duplicate rows.
 *   - BUG-SHO-01 fix: shopify_inventory.available stored as DECIMAL(12,4), not INT.
 *   - BUG-SHO-02 fix: shopify_product_variants.inventory_quantity stored as DECIMAL(12,4).
 *   - BUG-SHO-04 fix: null available stored as NULL, not 0.
 *   - BUG-SHO-05 fix: null line item quantity stored as NULL, not 0.
 *   - BUG-SHO-06 fix: null product title/status stored as NULL, not empty string.
 */

import prisma from '../../db/prismaClient';
import {
  ShopifyOrderNode,
  ShopifyCustomerNode,
  ShopifyProductNode,
  ShopifyInventoryLevelNode,
} from '../../types/shopify.types';
import { transformOrder, transformOrderLineItems, transformRefunds } from '../../transform/shopify/orderTransformer';
import { transformCustomer } from '../../transform/shopify/customerTransformer';
import { transformProduct } from '../../transform/shopify/productTransformer';
import { transformProductVariants } from '../../transform/shopify/productVariantTransformer';
import { transformInventory } from '../../transform/shopify/inventoryTransformer';
import {
  upsertOrders,
  upsertOrderLineItems,
  upsertRefunds,
  upsertCustomers,
  upsertProducts,
  upsertProductVariants,
  upsertInventory,
} from '../../db/repositories/shopifyRepo';
import { SHOPIFY_PLATFORM, SHOPIFY_JOBS } from '../../constants/shopify';

// ---------------------------------------------------------------------------
// Test-scoped IDs — unique per table to avoid cross-test interference
// ---------------------------------------------------------------------------

const ORDER_ID     = 'gid://shopify/Order/test-sho-1001';
const ORDER_ID2    = 'gid://shopify/Order/test-sho-1002';
const LINE_ITEM_ID = 'gid://shopify/LineItem/test-sho-2001';
const LINE_ITEM_ID2 = 'gid://shopify/LineItem/test-sho-2002';
const REFUND_ID    = 'gid://shopify/Refund/test-sho-3001';
const CUSTOMER_ID  = 'gid://shopify/Customer/test-sho-5001';
const PRODUCT_ID   = 'gid://shopify/Product/test-sho-7001';
const VARIANT_ID   = 'gid://shopify/ProductVariant/test-sho-8001';
const VARIANT_ID2  = 'gid://shopify/ProductVariant/test-sho-8002';
const INVENTORY_ID = 'gid://shopify/InventoryLevel/test-sho-9001';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const orderFixture: ShopifyOrderNode = {
  id: ORDER_ID,
  name: '#1001',
  email: 'customer@example.com',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: 'FULFILLED',
  totalPriceSet: { shopMoney: { amount: '199.95' } },
  subtotalPriceSet: { shopMoney: { amount: '179.95' } },
  totalTaxSet: { shopMoney: { amount: '20.00' } },
  currencyCode: 'AUD',
  createdAt: '2026-04-10T10:00:00+10:00',
  processedAt: '2026-04-10T10:01:00+10:00',
  updatedAt: '2026-04-11T09:00:00+10:00',
  lineItems: {
    pageInfo: { hasNextPage: false },
    nodes: [
      {
        id: LINE_ITEM_ID,
        name: 'Blue Widget',
        sku: 'SKU-BLUE-001',
        quantity: 2,
        originalUnitPriceSet: { shopMoney: { amount: '99.95' } },
        discountedUnitPriceSet: { shopMoney: { amount: '89.98' } },
        totalDiscountSet: { shopMoney: { amount: '9.97' } },
      },
    ],
  },
  refunds: [
    {
      id: REFUND_ID,
      createdAt: '2026-04-12T08:00:00+10:00',
      note: 'Customer changed mind',
      totalRefundedSet: { shopMoney: { amount: '89.98' } },
    },
  ],
};

// BUG-SHO-05 fix verified: order with null quantity line item
const orderFixture2: ShopifyOrderNode = {
  id: ORDER_ID2,
  name: '#1002',
  email: null,
  displayFinancialStatus: null,
  displayFulfillmentStatus: null,
  totalPriceSet: null,
  subtotalPriceSet: null,
  totalTaxSet: null,
  currencyCode: null,
  createdAt: null,
  processedAt: null,
  updatedAt: null,
  lineItems: {
    pageInfo: { hasNextPage: false },
    nodes: [
      {
        id: LINE_ITEM_ID2,
        name: null,
        sku: null,
        quantity: null,   // BUG-SHO-05: must store NULL, not 0
        originalUnitPriceSet: null,
        discountedUnitPriceSet: null,
        totalDiscountSet: null,
      },
    ],
  },
  refunds: [],
};

const customerFixture: ShopifyCustomerNode = {
  id: CUSTOMER_ID,
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+61412345678',
  createdAt: '2025-06-01T08:00:00+10:00',
  updatedAt: '2026-03-20T14:30:00+10:00',
};

// BUG-SHO-06 fix verified: null title/status stored as NULL, not ''
const productFixture: ShopifyProductNode = {
  id: PRODUCT_ID,
  title: 'Blue Widget',
  status: 'ACTIVE',
  createdAt: '2025-01-15T10:00:00+10:00',
  updatedAt: '2026-04-10T14:00:00+10:00',
  variants: {
    nodes: [
      {
        id: VARIANT_ID,
        title: 'Small / Blue',
        sku: 'SKU-BLUE-S',
        price: '49.95',
        compareAtPrice: '59.95',
        inventoryQuantity: 100,   // BUG-SHO-02: must store as DECIMAL(12,4)
        position: 1,
        createdAt: '2025-01-15T10:00:00+10:00',
        updatedAt: '2026-04-10T14:00:00+10:00',
      },
      {
        id: VARIANT_ID2,
        title: null,    // BUG-SHO-07: must store NULL, not undefined
        sku: null,      // BUG-SHO-07: must store NULL, not undefined
        price: null,
        compareAtPrice: null,
        inventoryQuantity: null,
        position: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
  },
};

// BUG-SHO-01 fix verified: available stored as DECIMAL(12,4)
// BUG-SHO-04 fix verified: null available stored as NULL, not 0
const inventoryFixture: ShopifyInventoryLevelNode = {
  id: INVENTORY_ID,
  available: 42,
  updatedAt: '2026-04-14T06:00:00+10:00',
};

const inventoryNullFixture: ShopifyInventoryLevelNode = {
  id: INVENTORY_ID + '-null',
  available: null,   // BUG-SHO-04: must store NULL, not 0
  updatedAt: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanTestRows() {
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_order_line_items WHERE shopify_order_id IN (?, ?)`, ORDER_ID, ORDER_ID2);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_refunds WHERE shopify_order_id IN (?, ?)`, ORDER_ID, ORDER_ID2);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_orders WHERE shopify_id IN (?, ?)`, ORDER_ID, ORDER_ID2);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_customers WHERE shopify_id = ?`, CUSTOMER_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_product_variants WHERE shopify_product_id = ?`, PRODUCT_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_products WHERE shopify_id = ?`, PRODUCT_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM shopify_inventory WHERE shopify_id IN (?, ?)`, INVENTORY_ID, INVENTORY_ID + '-null');
}

async function runPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');

  const orders      = [orderFixture, orderFixture2].map((r) => transformOrder(r, syncedAt));
  const lineItems   = [orderFixture, orderFixture2].flatMap((r) => transformOrderLineItems(r, syncedAt));
  const refunds     = [orderFixture, orderFixture2].flatMap((r) => transformRefunds(r, syncedAt));
  const customers   = [transformCustomer(customerFixture, syncedAt)];
  const products    = [transformProduct(productFixture, syncedAt)];
  const variants    = transformProductVariants(productFixture, syncedAt);
  const inventory   = [inventoryFixture, inventoryNullFixture].map((r) => transformInventory(r, syncedAt));

  const ordersSaved    = await upsertOrders(orders);
  const lineItemsSaved = await upsertOrderLineItems(lineItems);
  await upsertRefunds(refunds);
  const customersSaved = await upsertCustomers(customers);
  const productsSaved  = await upsertProducts(products);
  await upsertProductVariants(variants);
  const inventorySaved = await upsertInventory(inventory);

  return { ordersSaved, lineItemsSaved, customersSaved, productsSaved, inventorySaved };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await cleanTestRows();
  await runPipeline();
});

afterAll(async () => {
  await cleanTestRows();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

describe('Shopify pipeline — orders', () => {
  it('inserts 2 order rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_orders WHERE shopify_id IN (?, ?)`, ORDER_ID, ORDER_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores financial and fulfillment status', async () => {
    const rows = await prisma.$queryRawUnsafe<{ financial_status: string; fulfillment_status: string }[]>(
      `SELECT financial_status, fulfillment_status FROM shopify_orders WHERE shopify_id = ?`, ORDER_ID
    );
    expect(rows[0].financial_status).toBe('PAID');
    expect(rows[0].fulfillment_status).toBe('FULFILLED');
  });

  it('stores total_price as DECIMAL with precision', async () => {
    const rows = await prisma.$queryRawUnsafe<{ total_price: string }[]>(
      `SELECT CAST(total_price AS CHAR) AS total_price FROM shopify_orders WHERE shopify_id = ?`, ORDER_ID
    );
    expect(rows[0].total_price).toBe('199.95');
  });

  it('stores null money fields as NULL for an order with no price sets', async () => {
    const rows = await prisma.$queryRawUnsafe<{ total_price: string | null }[]>(
      `SELECT total_price FROM shopify_orders WHERE shopify_id = ?`, ORDER_ID2
    );
    expect(rows[0].total_price).toBeNull();
  });

  it('stores order_date as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ order_date: Date }[]>(
      `SELECT order_date FROM shopify_orders WHERE shopify_id = ?`, ORDER_ID
    );
    expect(rows[0].order_date.getUTCFullYear()).toBe(2026);
    expect(rows[0].order_date.getUTCMonth()).toBe(3); // April (0-indexed)
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_orders WHERE shopify_id IN (?, ?)`, ORDER_ID, ORDER_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Order Line Items
// ---------------------------------------------------------------------------

describe('Shopify pipeline — order line items', () => {
  it('inserts 2 line item rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_order_line_items WHERE shopify_order_id IN (?, ?)`, ORDER_ID, ORDER_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores name and sku on a full line item', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; sku: string }[]>(
      `SELECT name, sku FROM shopify_order_line_items WHERE shopify_line_item_id = ?`, LINE_ITEM_ID
    );
    expect(rows[0].name).toBe('Blue Widget');
    expect(rows[0].sku).toBe('SKU-BLUE-001');
  });

  it('stores original_unit_price as DECIMAL(12,4)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ original_unit_price: string }[]>(
      `SELECT CAST(original_unit_price AS CHAR) AS original_unit_price FROM shopify_order_line_items WHERE shopify_line_item_id = ?`,
      LINE_ITEM_ID
    );
    expect(rows[0].original_unit_price).toBe('99.9500');
  });

  it('stores null quantity as NULL (BUG-SHO-05 fix)', async () => {
    // Old code would store 0 for null quantities — hiding missing data as zero
    const rows = await prisma.$queryRawUnsafe<{ quantity: number | null }[]>(
      `SELECT quantity FROM shopify_order_line_items WHERE shopify_line_item_id = ?`, LINE_ITEM_ID2
    );
    expect(rows[0].quantity).toBeNull();
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_order_line_items WHERE shopify_order_id IN (?, ?)`, ORDER_ID, ORDER_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

describe('Shopify pipeline — refunds', () => {
  it('inserts 1 refund row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_refunds WHERE shopify_refund_id = ?`, REFUND_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores note and total_refunded', async () => {
    const rows = await prisma.$queryRawUnsafe<{ note: string; total_refunded: string }[]>(
      `SELECT note, CAST(total_refunded AS CHAR) AS total_refunded FROM shopify_refunds WHERE shopify_refund_id = ?`,
      REFUND_ID
    );
    expect(rows[0].note).toBe('Customer changed mind');
    expect(rows[0].total_refunded).toBe('89.98');
  });

  it('stores refunded_at as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ refunded_at: Date }[]>(
      `SELECT refunded_at FROM shopify_refunds WHERE shopify_refund_id = ?`, REFUND_ID
    );
    expect(rows[0].refunded_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].refunded_at.getUTCMonth()).toBe(3); // April (0-indexed)
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_refunds WHERE shopify_refund_id = ?`, REFUND_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

describe('Shopify pipeline — customers', () => {
  it('inserts 1 customer row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_customers WHERE shopify_id = ?`, CUSTOMER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores email, first_name, last_name, phone', async () => {
    const rows = await prisma.$queryRawUnsafe<{ email: string; first_name: string; last_name: string; phone: string }[]>(
      `SELECT email, first_name, last_name, phone FROM shopify_customers WHERE shopify_id = ?`, CUSTOMER_ID
    );
    expect(rows[0].email).toBe('jane.doe@example.com');
    expect(rows[0].first_name).toBe('Jane');
    expect(rows[0].last_name).toBe('Doe');
    expect(rows[0].phone).toBe('+61412345678');
  });

  it('stores src_created_at and src_modified_at as UTC datetimes', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_created_at: Date; src_modified_at: Date }[]>(
      `SELECT src_created_at, src_modified_at FROM shopify_customers WHERE shopify_id = ?`, CUSTOMER_ID
    );
    expect(rows[0].src_created_at.getUTCFullYear()).toBe(2025);
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_customers WHERE shopify_id = ?`, CUSTOMER_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

describe('Shopify pipeline — products', () => {
  it('inserts 1 product row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_products WHERE shopify_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores title and status (BUG-SHO-06 fix — null stored as NULL, not empty string)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ title: string; status: string }[]>(
      `SELECT title, status FROM shopify_products WHERE shopify_id = ?`, PRODUCT_ID
    );
    expect(rows[0].title).toBe('Blue Widget');
    expect(rows[0].status).toBe('ACTIVE');
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_products WHERE shopify_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Product Variants
// ---------------------------------------------------------------------------

describe('Shopify pipeline — product variants', () => {
  it('inserts 2 variant rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_product_variants WHERE shopify_product_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores price and compare_at_price as DECIMAL(12,4)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ price: string; compare_at_price: string }[]>(
      `SELECT CAST(price AS CHAR) AS price, CAST(compare_at_price AS CHAR) AS compare_at_price FROM shopify_product_variants WHERE shopify_variant_id = ?`,
      VARIANT_ID
    );
    expect(rows[0].price).toBe('49.9500');
    expect(rows[0].compare_at_price).toBe('59.9500');
  });

  it('stores inventory_quantity as DECIMAL(12,4) (BUG-SHO-02 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ inventory_quantity: string }[]>(
      `SELECT CAST(inventory_quantity AS CHAR) AS inventory_quantity FROM shopify_product_variants WHERE shopify_variant_id = ?`,
      VARIANT_ID
    );
    expect(rows[0].inventory_quantity).toBe('100.0000');
  });

  it('stores null title and sku as NULL (BUG-SHO-07 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ title: string | null; sku: string | null }[]>(
      `SELECT title, sku FROM shopify_product_variants WHERE shopify_variant_id = ?`, VARIANT_ID2
    );
    expect(rows[0].title).toBeNull();
    expect(rows[0].sku).toBeNull();
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_product_variants WHERE shopify_product_id = ?`, PRODUCT_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

describe('Shopify pipeline — inventory', () => {
  it('inserts 2 inventory rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_inventory WHERE shopify_id IN (?, ?)`,
      INVENTORY_ID, INVENTORY_ID + '-null'
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores available as DECIMAL(12,4) (BUG-SHO-01 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ available: string }[]>(
      `SELECT CAST(available AS CHAR) AS available FROM shopify_inventory WHERE shopify_id = ?`, INVENTORY_ID
    );
    expect(rows[0].available).toBe('42.0000');
  });

  it('stores null available as NULL (BUG-SHO-04 fix)', async () => {
    // Old code stored ?? 0, masking null inventory as zero stock
    const rows = await prisma.$queryRawUnsafe<{ available: string | null }[]>(
      `SELECT available FROM shopify_inventory WHERE shopify_id = ?`, INVENTORY_ID + '-null'
    );
    expect(rows[0].available).toBeNull();
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM shopify_inventory WHERE shopify_id IN (?, ?)`,
      INVENTORY_ID, INVENTORY_ID + '-null'
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cursor advancement (sync_config)
// ---------------------------------------------------------------------------

describe('Shopify pipeline — cursor advancement', () => {
  const TEST_PLATFORM = SHOPIFY_PLATFORM + '-cursor-test';

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM sync_config WHERE platform = ?`, TEST_PLATFORM);
  });

  it('cursor row does not exist before first run', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, SHOPIFY_JOBS.ORDERS
    );
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('stores and updates cursor date correctly', async () => {
    const firstSyncDate = new Date('2026-04-11T09:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, SHOPIFY_JOBS.ORDERS, firstSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, SHOPIFY_JOBS.ORDERS
    );
    expect(rows[0].last_synced_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].last_synced_at.getUTCMonth()).toBe(3);  // April (0-indexed)
    expect(rows[0].last_synced_at.getUTCDate()).toBe(11);
  });

  it('advances cursor on second run', async () => {
    const secondSyncDate = new Date('2026-04-15T03:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, SHOPIFY_JOBS.ORDERS, secondSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, SHOPIFY_JOBS.ORDERS
    );
    expect(rows[0].last_synced_at.getUTCDate()).toBe(15);
  });
});
