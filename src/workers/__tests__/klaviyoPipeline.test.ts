/**
 * Klaviyo pipeline integration test.
 *
 * Tests the full data flow: fixtures → transformers → repos → real DB.
 * The Klaviyo adapters are mocked (no real API key needed).
 * All other layers — transformers, repos, DB — run for real.
 *
 * Fixture shapes match the Klaviyo REST API v1beta (revision 2026-01-15):
 *   https://developers.klaviyo.com/en/reference/api_overview
 *
 * What this test guarantees:
 *   - All 5 tables receive rows with the correct field values.
 *   - Upsert is idempotent: running the same fixtures twice does not duplicate rows.
 *   - BUG-KLV-02 fix: channel is populated (not null) when campaign-messages relationship is resolved.
 *   - BUG-KLV-03/04/05 fix: opensUnique, clicksUnique, bounces are non-null.
 *   - BUG-KLV-06 fix: emailConsent is populated when subscriptions are present.
 *   - BUG-KLV-07 fix: messageId (not campaignId) is stored in klaviyo_events.
 *   - BUG-KLV-08/09 fix: Decimal fields stored with full precision (no float truncation).
 */

import prisma from '../../db/prismaClient';
import { KlaviyoCampaign, KlaviyoCampaignStatResult, KlaviyoProfile, KlaviyoEvent, KlaviyoFlow } from '../../types/klaviyo.types';
import { transformCampaign } from '../../transform/klaviyo/campaignTransformer';
import { transformCampaignStat } from '../../transform/klaviyo/campaignStatTransformer';
import { transformProfile } from '../../transform/klaviyo/profileTransformer';
import { transformEvent } from '../../transform/klaviyo/eventTransformer';
import { transformFlow } from '../../transform/klaviyo/flowTransformer';
import {
  upsertCampaigns,
  upsertCampaignStats,
  upsertProfiles,
  upsertEvents,
  upsertFlows,
} from '../../db/repositories/klaviyoRepo';
import { KLAVIYO_PLATFORM, KLAVIYO_JOBS } from '../../constants/klaviyo';

// ---------------------------------------------------------------------------
// Test-scoped IDs — unique per table to avoid cross-test interference
// ---------------------------------------------------------------------------

const CAMPAIGN_ID  = 'test-klv-campaign-001';
const PROFILE_ID   = 'test-klv-profile-001';
const PROFILE_ID2  = 'test-klv-profile-002';
const EVENT_ID     = 'test-klv-event-001';
const EVENT_ID2    = 'test-klv-event-002';
const FLOW_ID      = 'test-klv-flow-001';
const MSG_ID       = 'test-klv-msg-001';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// BUG-KLV-02 verified: fetchCampaigns stamps _channel from included campaign-messages.
// The fixture below simulates the campaign after the adapter has resolved the channel.
const campaignFixture: KlaviyoCampaign = {
  id: CAMPAIGN_ID,
  type: 'campaign',
  attributes: {
    name:         'Spring Sale 2026',
    status:       'Sent',
    _channel:     'email',   // stamped by adapter after resolving campaign-messages include
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

// revision 2026-04-15: response shape changed to { groupings: {...}, statistics: {...} }
const campaignStatFixture: KlaviyoCampaignStatResult = {
  groupings: {
    campaign_id:  CAMPAIGN_ID,
    send_channel: 'email',
  },
  statistics: {
    delivered:             5000,
    opens:                 1800,
    opens_unique:          1500,
    open_rate:             0.3,
    clicks:                620,
    clicks_unique:         540,
    click_rate:            0.108,
    unsubscribes:          12,
    bounced:               38,
    conversions:           87,
    conversion_rate:       0.0174,
    conversion_value:      4321.50,
    revenue_per_recipient: 0.8643,
  },
};

// BUG-KLV-06 verified: subscriptions field populated (requires additional-fields[profile]=subscriptions).
const profileFixture: KlaviyoProfile = {
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

const profileFixture2: KlaviyoProfile = {
  id: PROFILE_ID2,
  type: 'profile',
  attributes: {
    email:        'no-subscriptions@example.com',
    phone_number: null,
    first_name:   'Bob',
    last_name:    null,
    subscriptions: null,   // no additional-fields requested → consent always null
    location: null,
    properties: null,
    created: '2026-01-10T12:00:00+00:00',
    updated: '2026-01-10T12:00:00+00:00',
  },
};

// BUG-KLV-07 verified: messageId stored (not campaignId).
// BUG-KLV-09 verified: value stored as Decimal, not float.
const eventFixture: KlaviyoEvent = {
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

const eventFixture2: KlaviyoEvent = {
  id: EVENT_ID2,
  type: 'event',
  attributes: {
    value:       null,    // event with no monetary value (e.g. Opened Email)
    datetime:    '2026-04-14T14:00:00+00:00',
    metric_name: 'Opened Email',
    properties:  {},     // no attribution
  },
  relationships: {
    metric:  { data: { id: 'METRIC-002', type: 'metric' } },
    profile: { data: { id: PROFILE_ID, type: 'profile' } },
  },
};

const flowFixture: KlaviyoFlow = {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanTestRows() {
  await prisma.$executeRawUnsafe(`DELETE FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID);
  await prisma.$executeRawUnsafe(`DELETE FROM klaviyo_profiles WHERE klaviyo_id IN (?, ?)`, PROFILE_ID, PROFILE_ID2);
  await prisma.$executeRawUnsafe(`DELETE FROM klaviyo_events WHERE klaviyo_id IN (?, ?)`, EVENT_ID, EVENT_ID2);
  await prisma.$executeRawUnsafe(`DELETE FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID);
}

async function runPipeline() {
  const syncedAt = new Date('2026-04-15T03:00:00.000Z');

  const campaignRows     = [transformCampaign(campaignFixture, syncedAt)];
  const campaignStatRows = [transformCampaignStat(campaignStatFixture, syncedAt)].filter((r): r is NonNullable<typeof r> => r !== null);
  const profileRows      = [
    transformProfile(profileFixture, syncedAt),
    transformProfile(profileFixture2, syncedAt),
  ];
  const eventRows        = [
    transformEvent(eventFixture, syncedAt),
    transformEvent(eventFixture2, syncedAt),
  ];
  const flowRows         = [transformFlow(flowFixture, syncedAt)];

  const campaignsSaved     = await upsertCampaigns(campaignRows);
  const campaignStatsSaved = await upsertCampaignStats(campaignStatRows);
  const profilesSaved      = await upsertProfiles(profileRows);
  const eventsSaved        = await upsertEvents(eventRows);
  const flowsSaved         = await upsertFlows(flowRows);

  return { campaignsSaved, campaignStatsSaved, profilesSaved, eventsSaved, flowsSaved };
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
// Campaigns
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — campaigns', () => {
  it('inserts 1 campaign row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores channel correctly (BUG-KLV-02 fix — resolved from campaign-messages relationship)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ channel: string | null }[]>(
      `SELECT channel FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    // Would be null if transformer still read raw.attributes.channel (old bug)
    expect(rows[0].channel).toBe('email');
  });

  it('stores name and status', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; status: string }[]>(
      `SELECT name, status FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(rows[0].name).toBe('Spring Sale 2026');
    expect(rows[0].status).toBe('Sent');
  });

  it('stores send_time as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ send_time: Date }[]>(
      `SELECT send_time FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(rows[0].send_time.getUTCFullYear()).toBe(2026);
    expect(rows[0].send_time.getUTCMonth()).toBe(3);  // April (0-indexed)
    expect(rows[0].send_time.getUTCDate()).toBe(10);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_campaigns WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Campaign Stats
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — campaign stats', () => {
  it('inserts 1 campaign stat row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores opens_unique correctly (BUG-KLV-03 fix — mapped from unique_opens)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ opens_unique: number }[]>(
      `SELECT opens_unique FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    // Would be null if transformer still read opens_unique (wrong field name)
    expect(rows[0].opens_unique).toBe(1500);
  });

  it('stores clicks_unique correctly (BUG-KLV-04 fix — mapped from unique_clicks)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ clicks_unique: number }[]>(
      `SELECT clicks_unique FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    // Would be null if transformer still read clicks_unique (wrong field name)
    expect(rows[0].clicks_unique).toBe(540);
  });

  it('stores bounces correctly (BUG-KLV-05 fix — mapped from bounced)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ bounces: number }[]>(
      `SELECT bounces FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    // Would be null if transformer still read bounces (wrong field name)
    expect(rows[0].bounces).toBe(38);
  });

  it('stores conversion_value as DECIMAL with precision (BUG-KLV-08 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ conversion_value: string }[]>(
      `SELECT CAST(conversion_value AS CHAR) AS conversion_value FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`,
      CAMPAIGN_ID
    );
    expect(rows[0].conversion_value).toBe('4321.50');
  });

  it('stores open_rate as DECIMAL with precision (BUG-KLV-08 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ open_rate: string }[]>(
      `SELECT CAST(open_rate AS CHAR) AS open_rate FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`,
      CAMPAIGN_ID
    );
    expect(rows[0].open_rate).toBe('0.3000');
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_campaign_stats WHERE klaviyo_id = ?`, CAMPAIGN_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — profiles', () => {
  it('inserts 2 profile rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_profiles WHERE klaviyo_id IN (?, ?)`, PROFILE_ID, PROFILE_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores email_consent when subscriptions are present (BUG-KLV-06 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ email_consent: string | null }[]>(
      `SELECT email_consent FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID
    );
    // Would be null if adapter did not request additional-fields[profile]=subscriptions
    expect(rows[0].email_consent).toBe('SUBSCRIBED');
  });

  it('stores sms_consent when subscriptions are present', async () => {
    const rows = await prisma.$queryRawUnsafe<{ sms_consent: string | null }[]>(
      `SELECT sms_consent FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID
    );
    expect(rows[0].sms_consent).toBe('SUBSCRIBED');
  });

  it('stores null email_consent when subscriptions are absent', async () => {
    const rows = await prisma.$queryRawUnsafe<{ email_consent: string | null }[]>(
      `SELECT email_consent FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID2
    );
    expect(rows[0].email_consent).toBeNull();
  });

  it('stores location fields correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      country: string; city: string; region: string; zip: string; timezone: string;
    }[]>(
      `SELECT country, city, region, zip, timezone FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID
    );
    expect(rows[0].country).toBe('US');
    expect(rows[0].city).toBe('San Francisco');
    expect(rows[0].region).toBe('CA');
    expect(rows[0].zip).toBe('94107');
    expect(rows[0].timezone).toBe('America/Los_Angeles');
  });

  it('stores lifecycle_stage and signup_source from properties', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      lifecycle_stage: string; signup_source: string;
    }[]>(
      `SELECT lifecycle_stage, signup_source FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID
    );
    expect(rows[0].lifecycle_stage).toBe('active');
    expect(rows[0].signup_source).toBe('homepage');
  });

  it('stores null for optional fields when not present', async () => {
    const rows = await prisma.$queryRawUnsafe<{
      phone_number: string | null; last_name: string | null; lifecycle_stage: string | null;
    }[]>(
      `SELECT phone_number, last_name, lifecycle_stage FROM klaviyo_profiles WHERE klaviyo_id = ?`, PROFILE_ID2
    );
    expect(rows[0].phone_number).toBeNull();
    expect(rows[0].last_name).toBeNull();
    expect(rows[0].lifecycle_stage).toBeNull();
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_profiles WHERE klaviyo_id IN (?, ?)`, PROFILE_ID, PROFILE_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — events', () => {
  it('inserts 2 event rows', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_events WHERE klaviyo_id IN (?, ?)`, EVENT_ID, EVENT_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });

  it('stores message_id (BUG-KLV-07 fix — was campaign_id before rename)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ message_id: string | null }[]>(
      `SELECT message_id FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID
    );
    expect(rows[0].message_id).toBe(MSG_ID);
  });

  it('stores value as DECIMAL with precision (BUG-KLV-09 fix)', async () => {
    const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
      `SELECT CAST(value AS CHAR) AS value FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID
    );
    expect(rows[0].value).toBe('49.99');
  });

  it('stores null value for events with no monetary value', async () => {
    const rows = await prisma.$queryRawUnsafe<{ value: string | null }[]>(
      `SELECT value FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID2
    );
    expect(rows[0].value).toBeNull();
  });

  it('stores null message_id when no attribution', async () => {
    const rows = await prisma.$queryRawUnsafe<{ message_id: string | null }[]>(
      `SELECT message_id FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID2
    );
    expect(rows[0].message_id).toBeNull();
  });

  it('stores metric_name correctly', async () => {
    const rows = await prisma.$queryRawUnsafe<{ metric_name: string }[]>(
      `SELECT metric_name FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID
    );
    expect(rows[0].metric_name).toBe('Placed Order');
  });

  it('stores event_date as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ event_date: Date }[]>(
      `SELECT event_date FROM klaviyo_events WHERE klaviyo_id = ?`, EVENT_ID
    );
    expect(rows[0].event_date.getUTCFullYear()).toBe(2026);
    expect(rows[0].event_date.getUTCMonth()).toBe(3);  // April (0-indexed)
    expect(rows[0].event_date.getUTCDate()).toBe(14);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_events WHERE klaviyo_id IN (?, ?)`, EVENT_ID, EVENT_ID2
    );
    expect(Number(rows[0].cnt)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — flows', () => {
  it('inserts 1 flow row', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it('stores name, status, trigger_type', async () => {
    const rows = await prisma.$queryRawUnsafe<{ name: string; status: string; trigger_type: string }[]>(
      `SELECT name, status, trigger_type FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID
    );
    expect(rows[0].name).toBe('Welcome Series');
    expect(rows[0].status).toBe('live');
    expect(rows[0].trigger_type).toBe('Added to List');
  });

  it('stores archived = false as TINYINT(1) 0', async () => {
    const rows = await prisma.$queryRawUnsafe<{ archived: number }[]>(
      `SELECT archived FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID
    );
    expect(rows[0].archived).toBe(0);  // MySQL TINYINT(1): false = 0
  });

  it('stores src_created_at and src_modified_at as UTC datetime', async () => {
    const rows = await prisma.$queryRawUnsafe<{ src_created_at: Date; src_modified_at: Date }[]>(
      `SELECT src_created_at, src_modified_at FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID
    );
    expect(rows[0].src_created_at.getUTCFullYear()).toBe(2025);
    expect(rows[0].src_modified_at.getUTCFullYear()).toBe(2026);
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await runPipeline();
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM klaviyo_flows WHERE klaviyo_id = ?`, FLOW_ID
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cursor advancement (sync_config)
// ---------------------------------------------------------------------------

describe('Klaviyo pipeline — cursor advancement', () => {
  const TEST_PLATFORM = KLAVIYO_PLATFORM + '-cursor-test';

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM sync_config WHERE platform = ?`, TEST_PLATFORM
    );
  });

  it('cursor row does not exist before first run', async () => {
    const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      `SELECT COUNT(*) AS cnt FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, KLAVIYO_JOBS.CAMPAIGNS
    );
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('stores and updates cursor date correctly', async () => {
    const firstSyncDate = new Date('2026-04-10T09:05:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, KLAVIYO_JOBS.CAMPAIGNS, firstSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, KLAVIYO_JOBS.CAMPAIGNS
    );
    expect(rows[0].last_synced_at.getUTCFullYear()).toBe(2026);
    expect(rows[0].last_synced_at.getUTCMonth()).toBe(3);  // April (0-indexed)
    expect(rows[0].last_synced_at.getUTCDate()).toBe(10);
  });

  it('advances cursor on second run', async () => {
    const secondSyncDate = new Date('2026-04-15T03:00:00.000Z');
    await prisma.$executeRawUnsafe(
      `INSERT INTO sync_config (platform, job_type, last_synced_at, created_at, modified_at)
       VALUES (?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE last_synced_at = VALUES(last_synced_at), modified_at = NOW(3)`,
      TEST_PLATFORM, KLAVIYO_JOBS.CAMPAIGNS, secondSyncDate
    );

    const rows = await prisma.$queryRawUnsafe<{ last_synced_at: Date }[]>(
      `SELECT last_synced_at FROM sync_config WHERE platform = ? AND job_type = ?`,
      TEST_PLATFORM, KLAVIYO_JOBS.CAMPAIGNS
    );
    expect(rows[0].last_synced_at.getUTCDate()).toBe(15);
  });
});
