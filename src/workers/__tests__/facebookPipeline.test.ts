/**
 * Facebook pipeline integration test.
 *
 * Tests the full data flow: fixtures → transformers → repos → real DB.
 * The Facebook adapters are mocked (no real API credentials needed).
 * All other layers — transformers, repos, DB — run for real.
 *
 * Fixture shapes match the Facebook Graph API:
 *   https://developers.facebook.com/docs/marketing-api/reference
 *
 * What this test guarantees:
 *   - All 6 tables receive rows with the correct field values.
 *   - Upsert is idempotent: running the same fixtures twice does not duplicate rows.
 *   - daily_budget stored correctly (API value in cents, divided by 100 in transformer).
 *   - spend stored as DECIMAL, not integer.
 *   - purchases extracted from actions array correctly.
 *   - BUG-FB-04 fix: frequency column is populated on ad insight rows.
 *   - Null frequency stored as NULL.
 */

import prisma from '../../db/prismaClient';
import {
  FacebookCampaignRaw,
  FacebookAdsetRaw,
  FacebookAdRaw,
  FacebookCampaignInsightRaw,
  FacebookAdsetInsightRaw,
  FacebookAdInsightRaw,
} from '../../types/facebook.types';
import { transformCampaign }        from '../../transform/facebook/campaignTransformer';
import { transformAdset }           from '../../transform/facebook/adsetTransformer';
import { transformAd }              from '../../transform/facebook/adTransformer';
import { transformCampaignInsight } from '../../transform/facebook/campaignInsightTransformer';
import { transformAdsetInsight }    from '../../transform/facebook/adsetInsightTransformer';
import { transformAdInsight }       from '../../transform/facebook/adInsightTransformer';
import {
  upsertCampaigns,
  upsertAdsets,
  upsertAds,
  upsertCampaignInsights,
  upsertAdsetInsights,
  upsertAdInsights,
} from '../../db/repositories/facebookRepo';

// ---------------------------------------------------------------------------
// Mock adapters — not called in integration tests
// ---------------------------------------------------------------------------

jest.mock('../../adapters/facebook/campaigns',       () => ({ fetchCampaigns:       jest.fn() }));
jest.mock('../../adapters/facebook/adsets',          () => ({ fetchAdsets:          jest.fn() }));
jest.mock('../../adapters/facebook/ads',             () => ({ fetchAds:             jest.fn() }));
jest.mock('../../adapters/facebook/campaignInsights',() => ({ fetchCampaignInsights:jest.fn() }));
jest.mock('../../adapters/facebook/adsetInsights',   () => ({ fetchAdsetInsights:   jest.fn() }));
jest.mock('../../adapters/facebook/adInsights',      () => ({ fetchAdInsights:      jest.fn() }));

jest.mock('../../db/repositories/syncConfigRepo', () => ({
  getLastSyncedAt: jest.fn().mockResolvedValue(null),
  setLastSyncedAt: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../db/repositories/syncLogRepo', () => ({
  logQueued:  jest.fn().mockResolvedValue(1),
  logRunning: jest.fn().mockResolvedValue({ id: 1 }),
  logSuccess: jest.fn().mockResolvedValue(undefined),
  logFailure: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Test-scoped IDs — unique per table to avoid cross-test interference
// ---------------------------------------------------------------------------

const CAMPAIGN_ID   = 'test-fb-camp-9001';
const ADSET_ID      = 'test-fb-adset-9001';
const AD_ID         = 'test-fb-ad-9001';
const REPORT_DATE   = new Date('2026-04-10T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const campaignFixture: FacebookCampaignRaw = {
  id:           CAMPAIGN_ID,
  name:         'Test Campaign 9001',
  status:       'ACTIVE',
  objective:    'OUTCOME_SALES',
  created_time: '2026-03-01T08:00:00+0000',
  updated_time: '2026-04-10T12:00:00+0000',
};

const adsetFixture: FacebookAdsetRaw = {
  id:              ADSET_ID,
  name:            'Test Adset 9001',
  campaign_id:     CAMPAIGN_ID,
  status:          'ACTIVE',
  daily_budget:    '5000',    // API sends cents — transformer divides by 100 → 50.00
  lifetime_budget: null,
  created_time:    '2026-03-02T09:00:00+0000',
  updated_time:    '2026-04-10T13:00:00+0000',
};

const adFixture: FacebookAdRaw = {
  id:           AD_ID,
  name:         'Test Ad 9001',
  adset_id:     ADSET_ID,
  campaign_id:  CAMPAIGN_ID,
  status:       'ACTIVE',
  created_time: '2026-03-03T10:00:00+0000',
  updated_time: '2026-04-10T14:00:00+0000',
};

const campaignInsightFixture: FacebookCampaignInsightRaw = {
  campaign_id:   CAMPAIGN_ID,
  campaign_name: 'Test Campaign 9001',
  date_start:    '2026-04-10',
  spend:         '123.45',
  impressions:   '9500',
  clicks:        '380',
  reach:         '8200',
  frequency:     '1.1585',
  ctr:           '4.0000',
  cpc:           '0.3250',
  cpm:           '13.0000',
  actions: [
    { action_type: 'purchase',           value: '3'  },
    { action_type: 'add_to_cart',        value: '12' },
    { action_type: 'initiate_checkout',  value: '7'  },
    { action_type: 'landing_page_view',  value: '50' },
  ],
  action_values: [
    { action_type: 'purchase', value: '299.97' },
  ],
};

const adsetInsightFixture: FacebookAdsetInsightRaw = {
  adset_id:      ADSET_ID,
  adset_name:    'Test Adset 9001',
  campaign_id:   CAMPAIGN_ID,
  campaign_name: 'Test Campaign 9001',
  date_start:    '2026-04-10',
  spend:         '123.45',
  impressions:   '9500',
  clicks:        '380',
  reach:         '8200',
  frequency:     '1.1585',
  ctr:           '4.0000',
  cpc:           '0.3250',
  cpm:           '13.0000',
  actions: [
    { action_type: 'purchase',           value: '3'  },
    { action_type: 'add_to_cart',        value: '12' },
    { action_type: 'initiate_checkout',  value: '7'  },
    { action_type: 'landing_page_view',  value: '50' },
  ],
  action_values: [
    { action_type: 'purchase', value: '299.97' },
  ],
};

// BUG-FB-04: frequency must be present on ad insights
const adInsightFixture: FacebookAdInsightRaw = {
  ad_id:         AD_ID,
  ad_name:       'Test Ad 9001',
  adset_id:      ADSET_ID,
  adset_name:    'Test Adset 9001',
  campaign_id:   CAMPAIGN_ID,
  campaign_name: 'Test Campaign 9001',
  date_start:    '2026-04-10',
  spend:         '123.45',
  impressions:   '9500',
  clicks:        '380',
  reach:         '8200',
  frequency:     '1.1585',   // BUG-FB-04: must reach frequency column
  ctr:           '4.0000',
  cpc:           '0.3250',
  cpm:           '13.0000',
  actions: [
    { action_type: 'purchase',           value: '3'  },
    { action_type: 'add_to_cart',        value: '12' },
    { action_type: 'initiate_checkout',  value: '7'  },
    { action_type: 'landing_page_view',  value: '50' },
  ],
  action_values: [
    { action_type: 'purchase', value: '299.97' },
  ],
};

// Fixture with null frequency — for NULL storage assertion
const adInsightNullFrequencyFixture: FacebookAdInsightRaw = {
  ...adInsightFixture,
  frequency: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanTestRows() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM facebook_campaign_insights WHERE campaign_id = ? AND report_date = ?`,
    CAMPAIGN_ID, REPORT_DATE,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM facebook_adset_insights WHERE adset_id = ? AND report_date = ?`,
    ADSET_ID, REPORT_DATE,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM facebook_ad_insights WHERE ad_id = ? AND report_date = ?`,
    AD_ID, REPORT_DATE,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM facebook_ads       WHERE ad_id      = ?`, AD_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM facebook_adsets    WHERE adset_id   = ?`, ADSET_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM facebook_campaigns WHERE campaign_id = ?`, CAMPAIGN_ID);
}

async function runCampaignsJob() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformCampaign(campaignFixture, syncedAt)];
  return upsertCampaigns(rows);
}

async function runAdsetsJob() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformAdset(adsetFixture, syncedAt)];
  return upsertAdsets(rows);
}

async function runAdsJob() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformAd(adFixture, syncedAt)];
  return upsertAds(rows);
}

async function runCampaignInsightsJob() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformCampaignInsight(campaignInsightFixture, syncedAt)];
  return upsertCampaignInsights(rows);
}

async function runAdsetInsightsJob() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformAdsetInsight(adsetInsightFixture, syncedAt)];
  return upsertAdsetInsights(rows);
}

async function runAdInsightsJob(fixture: FacebookAdInsightRaw = adInsightFixture) {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');
  const rows     = [transformAdInsight(fixture, syncedAt)];
  return upsertAdInsights(rows);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await cleanTestRows();
});

afterAll(async () => {
  await cleanTestRows();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------

describe('CAMPAIGNS job', () => {
  beforeAll(async () => {
    await runCampaignsJob();
  });

  it('inserts 1 campaign with correct field values', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      campaign_id: string;
      campaign_name: string;
      status: string;
      objective: string;
    }[]>(
      `SELECT campaign_id, campaign_name, status, objective
       FROM facebook_campaigns WHERE campaign_id = ?`,
      CAMPAIGN_ID,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].campaign_name).toBe('Test Campaign 9001');
    expect(rows[0].status).toBe('ACTIVE');
    expect(rows[0].objective).toBe('OUTCOME_SALES');
  });

  it('is idempotent on second run', async () => {
    await runCampaignsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_campaigns WHERE campaign_id = ?`,
      CAMPAIGN_ID,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ADSETS
// ---------------------------------------------------------------------------

describe('ADSETS job', () => {
  beforeAll(async () => {
    await runAdsetsJob();
  });

  it('inserts 1 adset with correct field values', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      adset_id: string;
      adset_name: string;
      campaign_id: string;
      status: string;
    }[]>(
      `SELECT adset_id, adset_name, campaign_id, status
       FROM facebook_adsets WHERE adset_id = ?`,
      ADSET_ID,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].adset_id).toBe(ADSET_ID);
    expect(rows[0].adset_name).toBe('Test Adset 9001');
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].status).toBe('ACTIVE');
  });

  it('daily_budget stored correctly (divided by 100)', async () => {
    // API sends '5000' (cents) → transformer: parseFloat('5000') / 100 = 50.00
    const rows = await prisma.$queryRawUnsafe<{ daily_budget: string; lifetime_budget: string | null }[]>(
      `SELECT CAST(daily_budget AS CHAR) AS daily_budget, lifetime_budget
       FROM facebook_adsets WHERE adset_id = ?`,
      ADSET_ID,
    );
    expect(rows[0].daily_budget).toBe('50.00');
    expect(rows[0].lifetime_budget).toBeNull();
  });

  it('is idempotent on second run', async () => {
    await runAdsetsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_adsets WHERE adset_id = ?`,
      ADSET_ID,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ADS
// ---------------------------------------------------------------------------

describe('ADS job', () => {
  beforeAll(async () => {
    await runAdsJob();
  });

  it('inserts 1 ad with correct field values', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      ad_id: string;
      ad_name: string;
      adset_id: string;
      campaign_id: string;
      status: string;
    }[]>(
      `SELECT ad_id, ad_name, adset_id, campaign_id, status
       FROM facebook_ads WHERE ad_id = ?`,
      AD_ID,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ad_id).toBe(AD_ID);
    expect(rows[0].ad_name).toBe('Test Ad 9001');
    expect(rows[0].adset_id).toBe(ADSET_ID);
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].status).toBe('ACTIVE');
  });

  it('is idempotent on second run', async () => {
    await runAdsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_ads WHERE ad_id = ?`,
      AD_ID,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CAMPAIGN_INSIGHTS
// ---------------------------------------------------------------------------

describe('CAMPAIGN_INSIGHTS job', () => {
  beforeAll(async () => {
    await runCampaignInsightsJob();
  });

  it('inserts 1 campaign insight row with correct field values', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      campaign_id: string;
      campaign_name: string;
      impressions: number;
      clicks: number;
      reach: number;
    }[]>(
      `SELECT campaign_id, campaign_name, impressions, clicks, reach
       FROM facebook_campaign_insights
       WHERE campaign_id = ? AND report_date = ?`,
      CAMPAIGN_ID, REPORT_DATE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].campaign_name).toBe('Test Campaign 9001');
    expect(rows[0].impressions).toBe(9500);
    expect(rows[0].clicks).toBe(380);
    expect(rows[0].reach).toBe(8200);
  });

  it('spend stored as DECIMAL (not integer)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ spend: string }[]>(
      `SELECT CAST(spend AS CHAR) AS spend
       FROM facebook_campaign_insights
       WHERE campaign_id = ? AND report_date = ?`,
      CAMPAIGN_ID, REPORT_DATE,
    );
    expect(rows[0].spend).toBe('123.45');
  });

  it('purchases extracted from actions array correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ purchases: number }[]>(
      `SELECT purchases FROM facebook_campaign_insights
       WHERE campaign_id = ? AND report_date = ?`,
      CAMPAIGN_ID, REPORT_DATE,
    );
    expect(rows[0].purchases).toBe(3);
  });

  it('is idempotent on second run (upsert by campaignId + reportDate)', async () => {
    await runCampaignInsightsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_campaign_insights
       WHERE campaign_id = ? AND report_date = ?`,
      CAMPAIGN_ID, REPORT_DATE,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ADSET_INSIGHTS
// ---------------------------------------------------------------------------

describe('ADSET_INSIGHTS job', () => {
  beforeAll(async () => {
    await runAdsetInsightsJob();
  });

  it('inserts 1 adset insight row', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      adset_id: string;
      campaign_id: string;
      impressions: number;
    }[]>(
      `SELECT adset_id, campaign_id, impressions
       FROM facebook_adset_insights
       WHERE adset_id = ? AND report_date = ?`,
      ADSET_ID, REPORT_DATE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].adset_id).toBe(ADSET_ID);
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].impressions).toBe(9500);
  });

  it('is idempotent on second run', async () => {
    await runAdsetInsightsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_adset_insights
       WHERE adset_id = ? AND report_date = ?`,
      ADSET_ID, REPORT_DATE,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AD_INSIGHTS
// ---------------------------------------------------------------------------

describe('AD_INSIGHTS job', () => {
  beforeAll(async () => {
    await runAdInsightsJob();
  });

  it('inserts 1 ad insight row', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      ad_id: string;
      adset_id: string;
      campaign_id: string;
      impressions: number;
    }[]>(
      `SELECT ad_id, adset_id, campaign_id, impressions
       FROM facebook_ad_insights
       WHERE ad_id = ? AND report_date = ?`,
      AD_ID, REPORT_DATE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ad_id).toBe(AD_ID);
    expect(rows[0].adset_id).toBe(ADSET_ID);
    expect(rows[0].campaign_id).toBe(CAMPAIGN_ID);
    expect(rows[0].impressions).toBe(9500);
  });

  it('frequency column is populated (BUG-FB-04 fix assertion)', async () => {
    // Old code omitted frequency from the ad insight transformer/repo
    const rows = await prisma.$queryRawUnsafe<{ frequency: string }[]>(
      `SELECT CAST(frequency AS CHAR) AS frequency
       FROM facebook_ad_insights
       WHERE ad_id = ? AND report_date = ?`,
      AD_ID, REPORT_DATE,
    );
    expect(rows[0].frequency).not.toBeNull();
    expect(parseFloat(rows[0].frequency)).toBeCloseTo(1.1585, 3);
  });

  it('null frequency stored as NULL', async () => {
    // Run a separate upsert with null frequency to verify NULL is stored correctly
    const syncedAt = new Date('2026-04-15T03:30:00.000Z');
    await upsertAdInsights([transformAdInsight(adInsightNullFrequencyFixture, syncedAt)]);

    const rows = await prisma.$queryRawUnsafe<{ frequency: string | null }[]>(
      `SELECT frequency FROM facebook_ad_insights
       WHERE ad_id = ? AND report_date = ?`,
      AD_ID, REPORT_DATE,
    );
    expect(rows[0].frequency).toBeNull();

    // Restore the original fixture so idempotency test uses the real value
    await runAdInsightsJob();
  });

  it('is idempotent on second run', async () => {
    await runAdInsightsJob();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM facebook_ad_insights
       WHERE ad_id = ? AND report_date = ?`,
      AD_ID, REPORT_DATE,
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});
