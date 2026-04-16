/**
 * Seed script — Facebook test data
 *
 * Inserts representative Facebook fixtures into the database for manual inspection.
 * Run inside the Docker container:
 *
 *   npx tsx src/scripts/seedFacebookTestData.ts
 *
 * Rows are NOT cleaned up automatically — use the cleanup queries logged at the end
 * to remove them after inspection.
 *
 * Seed IDs are distinct from integration-test IDs (seed-fb-*-8001 vs test-fb-*-9001)
 * so both can coexist in the database simultaneously.
 */

import prisma from '../db/prismaClient';
import {
  FacebookCampaignRaw,
  FacebookAdsetRaw,
  FacebookAdRaw,
  FacebookCampaignInsightRaw,
  FacebookAdsetInsightRaw,
  FacebookAdInsightRaw,
} from '../types/facebook.types';
import { transformCampaign }        from '../transform/facebook/campaignTransformer';
import { transformAdset }           from '../transform/facebook/adsetTransformer';
import { transformAd }              from '../transform/facebook/adTransformer';
import { transformCampaignInsight } from '../transform/facebook/campaignInsightTransformer';
import { transformAdsetInsight }    from '../transform/facebook/adsetInsightTransformer';
import { transformAdInsight }       from '../transform/facebook/adInsightTransformer';
import {
  upsertCampaigns,
  upsertAdsets,
  upsertAds,
  upsertCampaignInsights,
  upsertAdsetInsights,
  upsertAdInsights,
} from '../db/repositories/facebookRepo';

// ---------------------------------------------------------------------------
// Seed IDs — distinct from integration-test IDs (test-fb-*-9001)
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = 'seed-fb-camp-8001';
const ADSET_ID    = 'seed-fb-adset-8001';
const AD_ID       = 'seed-fb-ad-8001';
const REPORT_DATE = '2026-04-09';   // one day before the integration-test date (2026-04-10)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const campaignFixtures: FacebookCampaignRaw[] = [
  {
    id:           CAMPAIGN_ID,
    name:         'Seed Campaign 8001',
    status:       'ACTIVE',
    objective:    'OUTCOME_SALES',
    created_time: '2026-02-01T08:00:00+0000',
    updated_time: '2026-04-09T12:00:00+0000',
  },
];

const adsetFixtures: FacebookAdsetRaw[] = [
  {
    id:              ADSET_ID,
    name:            'Seed Adset 8001',
    campaign_id:     CAMPAIGN_ID,
    status:          'ACTIVE',
    daily_budget:    '10000',   // API sends cents → transformer divides by 100 → 100.00
    lifetime_budget: null,
    created_time:    '2026-02-02T09:00:00+0000',
    updated_time:    '2026-04-09T13:00:00+0000',
  },
];

const adFixtures: FacebookAdRaw[] = [
  {
    id:           AD_ID,
    name:         'Seed Ad 8001',
    adset_id:     ADSET_ID,
    campaign_id:  CAMPAIGN_ID,
    status:       'ACTIVE',
    created_time: '2026-02-03T10:00:00+0000',
    updated_time: '2026-04-09T14:00:00+0000',
  },
];

const campaignInsightFixtures: FacebookCampaignInsightRaw[] = [
  {
    campaign_id:   CAMPAIGN_ID,
    campaign_name: 'Seed Campaign 8001',
    date_start:    REPORT_DATE,
    spend:         '250.75',
    impressions:   '18400',
    clicks:        '720',
    reach:         '15000',
    frequency:     '1.2267',
    ctr:           '3.9130',
    cpc:           '0.3483',
    cpm:           '13.6277',
    actions: [
      { action_type: 'purchase',          value: '8'   },
      { action_type: 'add_to_cart',       value: '30'  },
      { action_type: 'initiate_checkout', value: '18'  },
      { action_type: 'landing_page_view', value: '100' },
    ],
    action_values: [
      { action_type: 'purchase', value: '799.92' },
    ],
  },
];

const adsetInsightFixtures: FacebookAdsetInsightRaw[] = [
  {
    adset_id:      ADSET_ID,
    adset_name:    'Seed Adset 8001',
    campaign_id:   CAMPAIGN_ID,
    campaign_name: 'Seed Campaign 8001',
    date_start:    REPORT_DATE,
    spend:         '250.75',
    impressions:   '18400',
    clicks:        '720',
    reach:         '15000',
    frequency:     '1.2267',
    ctr:           '3.9130',
    cpc:           '0.3483',
    cpm:           '13.6277',
    actions: [
      { action_type: 'purchase',          value: '8'   },
      { action_type: 'add_to_cart',       value: '30'  },
      { action_type: 'initiate_checkout', value: '18'  },
      { action_type: 'landing_page_view', value: '100' },
    ],
    action_values: [
      { action_type: 'purchase', value: '799.92' },
    ],
  },
];

const adInsightFixtures: FacebookAdInsightRaw[] = [
  {
    ad_id:         AD_ID,
    ad_name:       'Seed Ad 8001',
    adset_id:      ADSET_ID,
    adset_name:    'Seed Adset 8001',
    campaign_id:   CAMPAIGN_ID,
    campaign_name: 'Seed Campaign 8001',
    date_start:    REPORT_DATE,
    spend:         '250.75',
    impressions:   '18400',
    clicks:        '720',
    reach:         '15000',
    frequency:     '1.2267',
    ctr:           '3.9130',
    cpc:           '0.3483',
    cpm:           '13.6277',
    actions: [
      { action_type: 'purchase',          value: '8'   },
      { action_type: 'add_to_cart',       value: '30'  },
      { action_type: 'initiate_checkout', value: '18'  },
      { action_type: 'landing_page_view', value: '100' },
    ],
    action_values: [
      { action_type: 'purchase', value: '799.92' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const syncedAt = new Date();
  console.log(`\nSeeding Facebook test data at ${syncedAt.toISOString()}\n`);

  const campaigns        = campaignFixtures.map((r) => transformCampaign(r, syncedAt));
  const adsets           = adsetFixtures.map((r) => transformAdset(r, syncedAt));
  const ads              = adFixtures.map((r) => transformAd(r, syncedAt));
  const campaignInsights = campaignInsightFixtures.map((r) => transformCampaignInsight(r, syncedAt));
  const adsetInsights    = adsetInsightFixtures.map((r) => transformAdsetInsight(r, syncedAt));
  const adInsights       = adInsightFixtures.map((r) => transformAdInsight(r, syncedAt));

  const campaignsSaved        = await upsertCampaigns(campaigns);
  const adsetsSaved           = await upsertAdsets(adsets);
  const adsSaved              = await upsertAds(ads);
  const campaignInsightsSaved = await upsertCampaignInsights(campaignInsights);
  const adsetInsightsSaved    = await upsertAdsetInsights(adsetInsights);
  const adInsightsSaved       = await upsertAdInsights(adInsights);

  console.log(`Campaigns inserted:         ${campaignsSaved}`);
  console.log(`Adsets inserted:            ${adsetsSaved}`);
  console.log(`Ads inserted:               ${adsSaved}`);
  console.log(`Campaign insights inserted: ${campaignInsightsSaved}`);
  console.log(`Adset insights inserted:    ${adsetInsightsSaved}`);
  console.log(`Ad insights inserted:       ${adInsightsSaved}`);

  console.log('\n-- Inspect queries --');
  console.log(`SELECT campaign_id, campaign_name, status, objective, src_created_at, src_modified_at FROM facebook_campaigns WHERE campaign_id = '${CAMPAIGN_ID}';`);
  console.log(`SELECT adset_id, adset_name, campaign_id, status, daily_budget, lifetime_budget FROM facebook_adsets WHERE adset_id = '${ADSET_ID}';`);
  console.log(`SELECT ad_id, ad_name, adset_id, campaign_id, status FROM facebook_ads WHERE ad_id = '${AD_ID}';`);
  console.log(`SELECT campaign_id, campaign_name, report_date, spend, impressions, clicks, reach, frequency, ctr, cpc, cpm, purchases, add_to_carts FROM facebook_campaign_insights WHERE campaign_id = '${CAMPAIGN_ID}' AND report_date = '${REPORT_DATE}';`);
  console.log(`SELECT adset_id, adset_name, campaign_id, report_date, spend, impressions, clicks, reach, frequency, purchases FROM facebook_adset_insights WHERE adset_id = '${ADSET_ID}' AND report_date = '${REPORT_DATE}';`);
  console.log(`SELECT ad_id, ad_name, adset_id, campaign_id, report_date, spend, impressions, clicks, reach, frequency, purchases FROM facebook_ad_insights WHERE ad_id = '${AD_ID}' AND report_date = '${REPORT_DATE}';`);

  console.log('\n-- Cleanup queries --');
  console.log(`DELETE FROM facebook_campaign_insights WHERE campaign_id = '${CAMPAIGN_ID}' AND report_date = '${REPORT_DATE}';`);
  console.log(`DELETE FROM facebook_adset_insights WHERE adset_id = '${ADSET_ID}' AND report_date = '${REPORT_DATE}';`);
  console.log(`DELETE FROM facebook_ad_insights WHERE ad_id = '${AD_ID}' AND report_date = '${REPORT_DATE}';`);
  console.log(`DELETE FROM facebook_ads WHERE ad_id = '${AD_ID}';`);
  console.log(`DELETE FROM facebook_adsets WHERE adset_id = '${ADSET_ID}';`);
  console.log(`DELETE FROM facebook_campaigns WHERE campaign_id = '${CAMPAIGN_ID}';`);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
