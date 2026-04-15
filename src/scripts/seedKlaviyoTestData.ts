/**
 * Seed script — Klaviyo test data
 *
 * Inserts Klaviyo fixture data into the database for visual inspection.
 * Unlike the integration test, this script does NOT clean up after itself,
 * so rows remain visible in the DB after the script exits.
 *
 * Usage (inside Docker):
 *   npx tsx src/scripts/seedKlaviyoTestData.ts
 *
 * To remove seeded rows:
 *   DELETE FROM klaviyo_campaigns WHERE klaviyo_id = 'seed-klv-campaign-001';
 *   DELETE FROM klaviyo_campaign_stats WHERE klaviyo_id = 'seed-klv-campaign-001';
 *   DELETE FROM klaviyo_profiles WHERE klaviyo_id IN ('seed-klv-profile-001', 'seed-klv-profile-002');
 *   DELETE FROM klaviyo_events WHERE klaviyo_id IN ('seed-klv-event-001', 'seed-klv-event-002');
 *   DELETE FROM klaviyo_flows WHERE klaviyo_id = 'seed-klv-flow-001';
 */

import prisma from '../db/prismaClient';
import { logger } from '../utils/logger';
import { KlaviyoCampaign, KlaviyoCampaignStatResult, KlaviyoProfile, KlaviyoEvent, KlaviyoFlow } from '../types/klaviyo.types';
import { transformCampaign } from '../transform/klaviyo/campaignTransformer';
import { transformCampaignStat } from '../transform/klaviyo/campaignStatTransformer';
import { transformProfile } from '../transform/klaviyo/profileTransformer';
import { transformEvent } from '../transform/klaviyo/eventTransformer';
import { transformFlow } from '../transform/klaviyo/flowTransformer';
import {
  upsertCampaigns,
  upsertCampaignStats,
  upsertProfiles,
  upsertEvents,
  upsertFlows,
} from '../db/repositories/klaviyoRepo';

const CAMPAIGN_ID = 'seed-klv-campaign-001';
const PROFILE_ID  = 'seed-klv-profile-001';
const PROFILE_ID2 = 'seed-klv-profile-002';
const EVENT_ID    = 'seed-klv-event-001';
const EVENT_ID2   = 'seed-klv-event-002';
const FLOW_ID     = 'seed-klv-flow-001';
const MSG_ID      = 'seed-klv-msg-001';

const syncedAt = new Date();

const campaign: KlaviyoCampaign = {
  id: CAMPAIGN_ID,
  type: 'campaign',
  attributes: {
    name:         'Spring Sale 2026',
    status:       'Sent',
    _channel:     'email',
    send_time:    '2026-04-10T09:00:00+00:00',
    created_at:   '2026-04-01T10:00:00+00:00',
    updated_at:   '2026-04-10T09:05:00+00:00',
    audiences:    null,
    send_options: null,
  },
  relationships: {
    'campaign-messages': {
      data: [{ id: MSG_ID, type: 'campaign-message' }],
    },
  },
};

const campaignStat: KlaviyoCampaignStatResult = {
  campaign_id:           CAMPAIGN_ID,
  delivered:             5000,
  opens:                 1800,
  unique_opens:          1500,
  open_rate:             0.3,
  clicks:                620,
  unique_clicks:         540,
  click_rate:            0.108,
  unsubscribes:          12,
  bounced:               38,
  conversions:           87,
  conversion_rate:       0.0174,
  conversion_value:      4321.50,
  revenue_per_recipient: 0.8643,
};

const profile1: KlaviyoProfile = {
  id: PROFILE_ID,
  type: 'profile',
  attributes: {
    email:        'jane.doe@example.com',
    phone_number: '+14155550001',
    first_name:   'Jane',
    last_name:    'Doe',
    subscriptions: {
      email: { marketing: { consent: 'SUBSCRIBED' } },
      sms:   { marketing: { consent: 'SUBSCRIBED' } },
    },
    location: {
      country:  'US',
      city:     'San Francisco',
      region:   'CA',
      zip:      '94107',
      timezone: 'America/Los_Angeles',
    },
    properties: {
      lifecycle_stage: 'active',
      signup_source:   'homepage',
    },
    created: '2025-11-15T08:30:00+00:00',
    updated: '2026-03-20T14:45:00+00:00',
  },
};

const profile2: KlaviyoProfile = {
  id: PROFILE_ID2,
  type: 'profile',
  attributes: {
    email:         'minimal@example.com',
    phone_number:  null,
    first_name:    'Min',
    last_name:     null,
    subscriptions: null,
    location:      null,
    properties:    null,
    created:       '2026-01-10T12:00:00+00:00',
    updated:       '2026-01-10T12:00:00+00:00',
  },
};

const event1: KlaviyoEvent = {
  id: EVENT_ID,
  type: 'event',
  attributes: {
    value:       49.99,
    datetime:    '2026-04-14T13:22:00+00:00',
    metric_name: 'Placed Order',
    properties:  { $attributed_message: MSG_ID },
  },
  relationships: {
    metric:  { data: { id: 'METRIC-001', type: 'metric' } },
    profile: { data: { id: PROFILE_ID, type: 'profile' } },
  },
};

const event2: KlaviyoEvent = {
  id: EVENT_ID2,
  type: 'event',
  attributes: {
    value:       null,
    datetime:    '2026-04-14T14:00:00+00:00',
    metric_name: 'Opened Email',
    properties:  {},
  },
  relationships: {
    metric:  { data: { id: 'METRIC-002', type: 'metric' } },
    profile: { data: { id: PROFILE_ID, type: 'profile' } },
  },
};

const flow: KlaviyoFlow = {
  id: FLOW_ID,
  type: 'flow',
  attributes: {
    name:         'Welcome Series',
    status:       'live',
    archived:     false,
    trigger_type: 'Added to List',
    created:      '2025-08-01T10:00:00+00:00',
    updated:      '2026-02-14T16:30:00+00:00',
  },
};

async function main() {
  logger.info('Seeding Klaviyo test data...');

  const campaignsSaved     = await upsertCampaigns([transformCampaign(campaign, syncedAt)]);
  const campaignStatsSaved = await upsertCampaignStats([transformCampaignStat(campaignStat, syncedAt)]);
  const profilesSaved      = await upsertProfiles([
    transformProfile(profile1, syncedAt),
    transformProfile(profile2, syncedAt),
  ]);
  const eventsSaved        = await upsertEvents([
    transformEvent(event1, syncedAt),
    transformEvent(event2, syncedAt),
  ]);
  const flowsSaved         = await upsertFlows([transformFlow(flow, syncedAt)]);

  logger.info({
    campaignsSaved,
    campaignStatsSaved,
    profilesSaved,
    eventsSaved,
    flowsSaved,
  }, 'Klaviyo seed complete');

  logger.info('Inspect with:');
  logger.info(`  SELECT * FROM klaviyo_campaigns WHERE klaviyo_id = '${CAMPAIGN_ID}';`);
  logger.info(`  SELECT * FROM klaviyo_campaign_stats WHERE klaviyo_id = '${CAMPAIGN_ID}';`);
  logger.info(`  SELECT * FROM klaviyo_profiles WHERE klaviyo_id IN ('${PROFILE_ID}', '${PROFILE_ID2}');`);
  logger.info(`  SELECT * FROM klaviyo_events WHERE klaviyo_id IN ('${EVENT_ID}', '${EVENT_ID2}');`);
  logger.info(`  SELECT * FROM klaviyo_flows WHERE klaviyo_id = '${FLOW_ID}';`);

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'Seed script failed');
  process.exit(1);
});
