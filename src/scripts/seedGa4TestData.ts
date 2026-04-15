/**
 * One-off script to insert GA4 test fixture data into the database.
 * Useful for visually inspecting rows after running the full pipeline.
 *
 * Run inside Docker:
 *   npx tsx src/scripts/seedGa4TestData.ts
 *
 * Clean up afterwards:
 *   DELETE FROM ga4_sessions WHERE property_id = 'test-property-ga4-seed';
 *   DELETE FROM ga4_ecommerce_events WHERE property_id = 'test-property-ga4-seed';
 *   DELETE FROM ga4_product_data WHERE property_id = 'test-property-ga4-seed';
 */

import { GA4SessionRow, GA4EcommerceEventRow, GA4ProductDataRow } from '../types/ga4.types';
import { transformSession } from '../transform/ga4/sessionTransformer';
import { transformEcommerceEvent } from '../transform/ga4/ecommerceEventTransformer';
import { transformProductData } from '../transform/ga4/productDataTransformer';
import { upsertSessions, upsertEcommerceEvents, upsertProductData } from '../db/repositories/ga4Repo';
import { logger } from '../utils/logger';
import prisma from '../db/prismaClient';

const PROPERTY_ID = 'test-property-ga4-seed';
const GA4_DATE    = '20260414';

const sessionFixtures: GA4SessionRow[] = [
  {
    date: GA4_DATE, source: 'google', medium: 'organic', campaign: '(not set)',
    deviceCategory: 'desktop', newVsReturning: 'new',
    sessions: '142', totalUsers: '130', newUsers: '80', pageViews: '420', engagementSeconds: '1823.457',
  },
  {
    date: GA4_DATE, source: 'direct', medium: '(none)', campaign: '(not set)',
    deviceCategory: 'mobile', newVsReturning: 'returning',
    sessions: '58', totalUsers: '50', newUsers: '12', pageViews: '175', engagementSeconds: '601.2',
  },
];

const ecommerceFixtures: GA4EcommerceEventRow[] = [
  { date: GA4_DATE, eventName: 'purchase',       source: 'google', medium: 'cpc',        transactions: '37', revenue: '4521.50', addToCarts: '0',   checkouts: '0'  },
  { date: GA4_DATE, eventName: 'add_to_cart',    source: 'direct', medium: '(none)',      transactions: '0',  revenue: '0',       addToCarts: '192', checkouts: '0'  },
  { date: GA4_DATE, eventName: 'begin_checkout', source: 'email',  medium: 'newsletter',  transactions: '0',  revenue: '0',       addToCarts: '0',   checkouts: '64' },
];

const productFixtures: GA4ProductDataRow[] = [
  {
    date: GA4_DATE, itemId: 'SKU-001', itemName: 'Blue Widget', itemBrand: 'Acme', itemCategory: 'Widgets',
    itemListViews: '540', itemListClicks: '102', itemViews: '88', addToCarts: '45', purchases: '12', revenue: '1440.00',
  },
  {
    date: GA4_DATE, itemId: 'SKU-002', itemName: 'Red Gadget', itemBrand: null, itemCategory: null,
    itemListViews: '210', itemListClicks: '37', itemViews: '29', addToCarts: '15', purchases: '7', revenue: '699.93',
  },
];

async function main() {
  const syncedAt = new Date();

  const sessionRows   = sessionFixtures.map((r) => transformSession(r, PROPERTY_ID, syncedAt));
  const ecommerceRows = ecommerceFixtures.map((r) => transformEcommerceEvent(r, PROPERTY_ID, syncedAt));
  const productRows   = productFixtures.map((r) => transformProductData(r, PROPERTY_ID, syncedAt));

  const sessionsSaved   = await upsertSessions(sessionRows);
  const ecommerceSaved  = await upsertEcommerceEvents(ecommerceRows);
  const productsSaved   = await upsertProductData(productRows);

  logger.info({ sessionsSaved, ecommerceSaved, productsSaved }, 'GA4 seed complete');

  logger.info('Query to inspect rows:');
  logger.info(`  SELECT * FROM ga4_sessions WHERE property_id = '${PROPERTY_ID}';`);
  logger.info(`  SELECT * FROM ga4_ecommerce_events WHERE property_id = '${PROPERTY_ID}';`);
  logger.info(`  SELECT * FROM ga4_product_data WHERE property_id = '${PROPERTY_ID}';`);

  logger.info('Query to clean up:');
  logger.info(`  DELETE FROM ga4_sessions WHERE property_id = '${PROPERTY_ID}';`);
  logger.info(`  DELETE FROM ga4_ecommerce_events WHERE property_id = '${PROPERTY_ID}';`);
  logger.info(`  DELETE FROM ga4_product_data WHERE property_id = '${PROPERTY_ID}';`);

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'Seed script failed');
  process.exit(1);
});
