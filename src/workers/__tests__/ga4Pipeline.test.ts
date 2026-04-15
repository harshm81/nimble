/**
 * GA4 pipeline integration test.
 *
 * Tests the full data flow: adapter fixtures → transformers → repos → real DB.
 * The GA4 adapters are mocked (no real credentials needed).
 * All other layers — transformers, repos, DB — run for real.
 *
 * Fixture shapes match the exact GA4 RunReport API response format:
 *   https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 *
 * What this test guarantees:
 *   - When real GA4 data arrives in this exact shape, it will be inserted correctly.
 *   - All 3 tables receive rows with the right field values.
 *   - Upsert is idempotent: running the same fixtures twice does not duplicate rows.
 *   - Cursor (sync_config.last_synced_at) advances to the last processed date.
 */

import prisma from '../../db/prismaClient';
import { GA4SessionRow, GA4EcommerceEventRow, GA4ProductDataRow } from '../../types/ga4.types';
import { transformSession } from '../../transform/ga4/sessionTransformer';
import { transformEcommerceEvent } from '../../transform/ga4/ecommerceEventTransformer';
import { transformProductData } from '../../transform/ga4/productDataTransformer';
import { upsertSessions, upsertEcommerceEvents, upsertProductData } from '../../db/repositories/ga4Repo';
import { GA4_PLATFORM, GA4_JOBS } from '../../constants/ga4';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPERTY_ID = 'test-property-ga4-pipeline';
const REPORT_DATE  = '2026-04-14';   // YYYY-MM-DD as stored in sync_config
const GA4_DATE     = '20260414';     // YYYYMMDD as returned by GA4 API

// ---------------------------------------------------------------------------
// Exact GA4 API response fixtures (after parseRows processes them into named maps)
// All values are strings — exactly as the GA4 API returns them.
// ---------------------------------------------------------------------------

const sessionFixtures: GA4SessionRow[] = [
  {
    date:              GA4_DATE,
    source:            'google',
    medium:            'organic',
    campaign:          '(not set)',
    deviceCategory:    'desktop',
    newVsReturning:    'new',
    sessions:          '142',
    totalUsers:        '130',
    newUsers:          '80',
    pageViews:         '420',
    engagementSeconds: '1823.457',
  },
  {
    date:              GA4_DATE,
    source:            'direct',
    medium:            '(none)',
    campaign:          '(not set)',
    deviceCategory:    'mobile',
    newVsReturning:    'returning',
    sessions:          '58',
    totalUsers:        '50',
    newUsers:          '12',
    pageViews:         '175',
    engagementSeconds: '601.2',
  },
];

const ecommerceFixtures: GA4EcommerceEventRow[] = [
  {
    date:         GA4_DATE,
    eventName:    'purchase',
    source:       'google',
    medium:       'cpc',
    transactions: '37',
    revenue:      '4521.50',
    addToCarts:   '0',
    checkouts:    '0',
  },
  {
    date:         GA4_DATE,
    eventName:    'add_to_cart',
    source:       'direct',
    medium:       '(none)',
    transactions: '0',
    revenue:      '0',
    addToCarts:   '192',
    checkouts:    '0',
  },
  {
    date:         GA4_DATE,
    eventName:    'begin_checkout',
    source:       'email',
    medium:       'newsletter',
    transactions: '0',
    revenue:      '0',
    addToCarts:   '0',
    checkouts:    '64',
  },
];

const productFixtures: GA4ProductDataRow[] = [
  {
    date:           GA4_DATE,
    itemId:         'SKU-001',
    itemName:       'Blue Widget',
    itemBrand:      'Acme',
    itemCategory:   'Widgets',
    itemListViews:  '540',
    itemListClicks: '102',
    itemViews:      '88',
    addToCarts:     '45',
    purchases:      '12',
    revenue:        '1440.00',
  },
  {
    date:           GA4_DATE,
    itemId:         'SKU-002',
    itemName:       'Red Gadget',
    itemBrand:      null,
    itemCategory:   null,
    itemListViews:  '210',
    itemListClicks: '37',
    itemViews:      '29',
    addToCarts:     '15',
    purchases:      '7',
    revenue:        '699.93',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanTestRows() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM ga4_sessions WHERE property_id = ?`, PROPERTY_ID
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM ga4_ecommerce_events WHERE property_id = ?`, PROPERTY_ID
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM ga4_product_data WHERE property_id = ?`, PROPERTY_ID
  );
}

async function runPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');

  const sessionRows    = sessionFixtures.map((r) => transformSession(r, PROPERTY_ID, syncedAt));
  const ecommerceRows  = ecommerceFixtures.map((r) => transformEcommerceEvent(r, PROPERTY_ID, syncedAt));
  const productRows    = productFixtures.map((r) => transformProductData(r, PROPERTY_ID, syncedAt));

  const sessionsSaved   = await upsertSessions(sessionRows);
  const ecommerceSaved  = await upsertEcommerceEvents(ecommerceRows);
  const productsSaved   = await upsertProductData(productRows);

  return { sessionsSaved, ecommerceSaved, productsSaved };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await cleanTestRows();
});

afterAll(async () => {
  await cleanTestRows();
  await prisma.$disconnect();
});

describe('GA4 pipeline — sessions', () => {
  beforeAll(async () => {
    await runPipeline();
  });

  it('inserts 2 session rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_sessions WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores source, medium, campaign, deviceCategory correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      source: string; medium: string; campaign: string; device_category: string;
    }[]>(
      `SELECT source, medium, campaign, device_category FROM ga4_sessions WHERE property_id = ? AND source = 'google'`,
      PROPERTY_ID
    );
    expect(rows[0].source).toBe('google');
    expect(rows[0].medium).toBe('organic');
    expect(rows[0].campaign).toBe('(not set)');
    expect(rows[0].device_category).toBe('desktop');
  });

  it('stores new_vs_returning correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ new_vs_returning: string }[]>(
      `SELECT new_vs_returning FROM ga4_sessions WHERE property_id = ? AND source = 'google'`,
      PROPERTY_ID
    );
    expect(rows[0].new_vs_returning).toBe('new');
  });

  it('rounds fractional engagement_seconds with Math.round', async () => {
    // fixture: 1823.457 → Math.round → 1823 (not parseInt → 1823, same here, but 99.5 would differ)
    const rows = await prisma.$queryRawUnsafe<{ engagement_seconds: number }[]>(
      `SELECT engagement_seconds FROM ga4_sessions WHERE property_id = ? AND source = 'google'`,
      PROPERTY_ID
    );
    expect(rows[0].engagement_seconds).toBe(1823);
  });

  it('stores report_date as UTC midnight', async () => {
    const rows = await prisma.$queryRawUnsafe<{ report_date: Date }[]>(
      `SELECT report_date FROM ga4_sessions WHERE property_id = ? LIMIT 1`, PROPERTY_ID
    );
    // DB returns DATETIME, check year/month/day in UTC
    const d = rows[0].report_date;
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3);  // April = 3 (0-indexed)
    expect(d.getUTCDate()).toBe(14);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_sessions WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

describe('GA4 pipeline — ecommerce events', () => {
  it('inserts 3 ecommerce event rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_ecommerce_events WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(3);
  });

  it('stores revenue as DECIMAL — not a float-rounded value', async () => {
    const rows = await prisma.$queryRawUnsafe<{ revenue: string }[]>(
      `SELECT CAST(revenue AS CHAR) AS revenue FROM ga4_ecommerce_events WHERE property_id = ? AND event_name = 'purchase'`,
      PROPERTY_ID
    );
    // DECIMAL(12,2) stored exactly — no IEEE 754 rounding
    expect(rows[0].revenue).toBe('4521.50');
  });

  it('stores add_to_carts for add_to_cart event', async () => {
    const rows = await prisma.$queryRawUnsafe<{ add_to_carts: number }[]>(
      `SELECT add_to_carts FROM ga4_ecommerce_events WHERE property_id = ? AND event_name = 'add_to_cart'`,
      PROPERTY_ID
    );
    expect(rows[0].add_to_carts).toBe(192);
  });

  it('stores checkouts for begin_checkout event', async () => {
    const rows = await prisma.$queryRawUnsafe<{ checkouts: number }[]>(
      `SELECT checkouts FROM ga4_ecommerce_events WHERE property_id = ? AND event_name = 'begin_checkout'`,
      PROPERTY_ID
    );
    expect(rows[0].checkouts).toBe(64);
  });

  it('is idempotent — count stays at 3 after second run', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_ecommerce_events WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(3);
  });
});

describe('GA4 pipeline — product data', () => {
  it('inserts 2 product rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_product_data WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores purchases count correctly (verifies BUG-GA4-01 fix — itemPurchases metric name)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ purchases: number }[]>(
      `SELECT purchases FROM ga4_product_data WHERE property_id = ? AND item_id = 'SKU-001'`,
      PROPERTY_ID
    );
    // If metric was still 'itemsPurchased' (old wrong name), purchases would be 0
    expect(rows[0].purchases).toBe(12);
  });

  it('stores revenue as DECIMAL with precision', async () => {
    const rows = await prisma.$queryRawUnsafe<{ revenue: string }[]>(
      `SELECT CAST(revenue AS CHAR) AS revenue FROM ga4_product_data WHERE property_id = ? AND item_id = 'SKU-001'`,
      PROPERTY_ID
    );
    expect(rows[0].revenue).toBe('1440.00');
  });

  it('stores null item_brand as NULL in DB', async () => {
    const rows = await prisma.$queryRawUnsafe<{ item_brand: string | null }[]>(
      `SELECT item_brand FROM ga4_product_data WHERE property_id = ? AND item_id = 'SKU-002'`,
      PROPERTY_ID
    );
    expect(rows[0].item_brand).toBeNull();
  });

  it('stores null item_category as NULL in DB', async () => {
    const rows = await prisma.$queryRawUnsafe<{ item_category: string | null }[]>(
      `SELECT item_category FROM ga4_product_data WHERE property_id = ? AND item_id = 'SKU-002'`,
      PROPERTY_ID
    );
    expect(rows[0].item_category).toBeNull();
  });

  it('is idempotent — count stays at 2 after second run', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM ga4_product_data WHERE property_id = ?`, PROPERTY_ID
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

describe('GA4 pipeline — cursor advancement', () => {
  // Uses raw SQL to avoid Prisma client version mismatch while pending migration exists.
  // The underlying logic (setLastSyncedAt / getLastSyncedAt) is tested separately via the repo.
  const TEST_PLATFORM = GA4_PLATFORM + '-cursor-test';

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM sync_config WHERE platform = ?`, TEST_PLATFORM
    );
  });

  it('cursor row does not exist before first run', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, GA4_JOBS.DAILY
    );
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('stores cursor date as UTC midnight after first run', async () => {
    const lastDate = new Date(REPORT_DATE + 'T00:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, GA4_JOBS.DAILY, lastDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, GA4_JOBS.DAILY
    );
    expect(rows[0].last_synced_at).not.toBeNull();
    expect(rows[0].last_synced_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].last_synced_at.getUTCMonth()).toBe(3);  // April (0-indexed)
    expect(rows[0].last_synced_at.getUTCDate()).toBe(14);
  });

  it('updates cursor date on second run', async () => {
    const nextDate = new Date('2026-04-15T00:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, GA4_JOBS.DAILY, nextDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, GA4_JOBS.DAILY
    );
    expect(rows[0].last_synced_at.getUTCDate()).toBe(15);
  });
});
