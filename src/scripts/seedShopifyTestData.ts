/**
 * Seed script — Shopify test data
 *
 * Inserts representative Shopify fixtures into the database for manual inspection.
 * Run inside the Docker container:
 *
 *   npx tsx src/scripts/seedShopifyTestData.ts
 *
 * Rows are NOT cleaned up automatically — use the cleanup queries logged at the end
 * to remove them after inspection.
 */

import prisma from '../db/prismaClient';
import {
  ShopifyOrderNode,
  ShopifyCustomerNode,
  ShopifyProductNode,
  ShopifyInventoryLevelNode,
} from '../types/shopify.types';
import { transformOrder, transformOrderLineItems, transformRefunds } from '../transform/shopify/orderTransformer';
import { transformCustomer } from '../transform/shopify/customerTransformer';
import { transformProduct } from '../transform/shopify/productTransformer';
import { transformProductVariants } from '../transform/shopify/productVariantTransformer';
import { transformInventory } from '../transform/shopify/inventoryTransformer';
import {
  upsertOrders,
  upsertOrderLineItems,
  upsertRefunds,
  upsertCustomers,
  upsertProducts,
  upsertProductVariants,
  upsertInventory,
} from '../db/repositories/shopifyRepo';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORDER_ID    = 'gid://shopify/Order/seed-sho-1001';
const CUSTOMER_ID = 'gid://shopify/Customer/seed-sho-5001';
const PRODUCT_ID  = 'gid://shopify/Product/seed-sho-7001';
const INV_ID      = 'gid://shopify/InventoryLevel/seed-sho-9001';

const orderFixtures: ShopifyOrderNode[] = [
  {
    id: ORDER_ID,
    name: '#SEED-001',
    email: 'seed.customer@example.com',
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
          id: 'gid://shopify/LineItem/seed-sho-2001',
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
        id: 'gid://shopify/Refund/seed-sho-3001',
        createdAt: '2026-04-12T08:00:00+10:00',
        note: 'Customer changed mind',
        totalRefundedSet: { shopMoney: { amount: '89.98' } },
      },
    ],
  },
];

const customerFixtures: ShopifyCustomerNode[] = [
  {
    id: CUSTOMER_ID,
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+61412345678',
    createdAt: '2025-06-01T08:00:00+10:00',
    updatedAt: '2026-03-20T14:30:00+10:00',
  },
];

const productFixtures: ShopifyProductNode[] = [
  {
    id: PRODUCT_ID,
    title: 'Blue Widget',
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:00:00+10:00',
    updatedAt: '2026-04-10T14:00:00+10:00',
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/seed-sho-8001',
          title: 'Small / Blue',
          sku: 'SKU-BLUE-S',
          price: '49.95',
          compareAtPrice: '59.95',
          inventoryQuantity: 100,
          position: 1,
          createdAt: '2025-01-15T10:00:00+10:00',
          updatedAt: '2026-04-10T14:00:00+10:00',
        },
        {
          id: 'gid://shopify/ProductVariant/seed-sho-8002',
          title: 'Large / Blue',
          sku: 'SKU-BLUE-L',
          price: '54.95',
          compareAtPrice: null,
          inventoryQuantity: 25,
          position: 2,
          createdAt: '2025-01-15T10:00:00+10:00',
          updatedAt: '2026-04-10T14:00:00+10:00',
        },
      ],
    },
  },
];

const inventoryFixtures: ShopifyInventoryLevelNode[] = [
  {
    id: INV_ID,
    available: 42,
    updatedAt: '2026-04-14T06:00:00+10:00',
  },
  {
    id: INV_ID + '-null',
    available: null,  // null = no warehouse assignment, not zero stock
    updatedAt: null,
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const syncedAt = new Date();
  console.log(`\nSeeding Shopify test data at ${syncedAt.toISOString()}\n`);

  const orders    = orderFixtures.map((r) => transformOrder(r, syncedAt));
  const lineItems = orderFixtures.flatMap((r) => transformOrderLineItems(r, syncedAt));
  const refunds   = orderFixtures.flatMap((r) => transformRefunds(r, syncedAt));
  const customers = customerFixtures.map((r) => transformCustomer(r, syncedAt));
  const products  = productFixtures.map((r) => transformProduct(r, syncedAt));
  const variants  = productFixtures.flatMap((r) => transformProductVariants(r, syncedAt));
  const inventory = inventoryFixtures.map((r) => transformInventory(r, syncedAt));

  const ordersSaved    = await upsertOrders(orders);
  const lineItemsSaved = await upsertOrderLineItems(lineItems);
  const refundsSaved   = await upsertRefunds(refunds);
  const customersSaved = await upsertCustomers(customers);
  const productsSaved  = await upsertProducts(products);
  const variantsSaved  = await upsertProductVariants(variants);
  const inventorySaved = await upsertInventory(inventory);

  console.log(`Orders inserted:         ${ordersSaved}`);
  console.log(`Line items inserted:     ${lineItemsSaved}`);
  console.log(`Refunds inserted:        ${refundsSaved}`);
  console.log(`Customers inserted:      ${customersSaved}`);
  console.log(`Products inserted:       ${productsSaved}`);
  console.log(`Variants inserted:       ${variantsSaved}`);
  console.log(`Inventory rows inserted: ${inventorySaved}`);

  console.log('\n-- Inspect queries --');
  console.log(`SELECT * FROM shopify_orders WHERE shopify_id = '${ORDER_ID}';`);
  console.log(`SELECT * FROM shopify_order_line_items WHERE shopify_order_id = '${ORDER_ID}';`);
  console.log(`SELECT * FROM shopify_refunds WHERE shopify_order_id = '${ORDER_ID}';`);
  console.log(`SELECT * FROM shopify_customers WHERE shopify_id = '${CUSTOMER_ID}';`);
  console.log(`SELECT * FROM shopify_products WHERE shopify_id = '${PRODUCT_ID}';`);
  console.log(`SELECT * FROM shopify_product_variants WHERE shopify_product_id = '${PRODUCT_ID}';`);
  console.log(`SELECT shopify_id, CAST(available AS CHAR) AS available, src_modified_at FROM shopify_inventory WHERE shopify_id LIKE 'gid://shopify/InventoryLevel/seed-%';`);

  console.log('\n-- Cleanup queries --');
  console.log(`DELETE FROM shopify_order_line_items WHERE shopify_order_id = '${ORDER_ID}';`);
  console.log(`DELETE FROM shopify_refunds WHERE shopify_order_id = '${ORDER_ID}';`);
  console.log(`DELETE FROM shopify_orders WHERE shopify_id = '${ORDER_ID}';`);
  console.log(`DELETE FROM shopify_customers WHERE shopify_id = '${CUSTOMER_ID}';`);
  console.log(`DELETE FROM shopify_product_variants WHERE shopify_product_id = '${PRODUCT_ID}';`);
  console.log(`DELETE FROM shopify_products WHERE shopify_id = '${PRODUCT_ID}';`);
  console.log(`DELETE FROM shopify_inventory WHERE shopify_id LIKE 'gid://shopify/InventoryLevel/seed-%';`);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
