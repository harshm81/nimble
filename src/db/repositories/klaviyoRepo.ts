import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

export interface CampaignInput {
  klaviyoId: string;
  name: string | null;
  status: string | null;
  channel: string | null;
  sendTime: Date | null;
  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;
  rawData: object;
  syncedAt: Date;
}

export interface CampaignStatInput {
  klaviyoId: string;
  delivered: number | null;
  opens: number | null;
  opensUnique: number | null;
  openRate: number | null;
  clicks: number | null;
  clicksUnique: number | null;
  clickRate: number | null;
  unsubscribes: number | null;
  bounces: number | null;
  conversions: number | null;
  conversionRate: number | null;
  conversionValue: number | null;
  revenuePerRecipient: number | null;
  rawData: object;
  syncedAt: Date;
}

export interface ProfileInput {
  klaviyoId: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;

  emailConsent: string | null;
  smsConsent: string | null;

  country: string | null;
  city: string | null;
  region: string | null;
  zip: string | null;
  timezone: string | null;

  lifecycleStage: string | null;
  signupSource: string | null;

  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;

  rawData: object;
  syncedAt: Date;
}

export interface EventInput {
  klaviyoId:  string;
  metricId:   string | null;
  metricName: string | null;
  profileId:  string | null;
  campaignId: string | null;
  value:      number | null;
  eventDate:  Date | null;
  rawData:    object;
  syncedAt:   Date;
}

export interface FlowInput {
  klaviyoId: string;
  name: string | null;
  status: string | null;
  archived: boolean | null;
  triggerType: string | null;

  srcCreatedAt: Date | null;
  srcModifiedAt: Date | null;

  rawData: object;
  syncedAt: Date;
}

export async function upsertCampaigns(rows: CampaignInput[]): Promise<number> {
  let total = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map(
        (r) =>
          Prisma.sql`(${r.klaviyoId}, ${r.name}, ${r.status}, ${r.channel}, ${r.sendTime}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO klaviyo_campaigns
        (klaviyo_id, name, status, channel, send_time, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name           = VALUES(name),
        status         = VALUES(status),
        channel        = VALUES(channel),
        send_time      = VALUES(send_time),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data       = VALUES(raw_data),
        synced_at      = VALUES(synced_at)
    `;
    total += c.length;
  }
  return total;
}

export async function upsertCampaignStats(rows: CampaignStatInput[]): Promise<number> {
  let total = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map(
        (r) =>
          Prisma.sql`(${r.klaviyoId}, ${r.delivered}, ${r.opens}, ${r.opensUnique}, ${r.openRate}, ${r.clicks}, ${r.clicksUnique}, ${r.clickRate}, ${r.unsubscribes}, ${r.bounces}, ${r.conversions}, ${r.conversionRate}, ${r.conversionValue}, ${r.revenuePerRecipient}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO klaviyo_campaign_stats
        (klaviyo_id, delivered, opens, opens_unique, open_rate, clicks, clicks_unique, click_rate, unsubscribes, bounces, conversions, conversion_rate, conversion_value, revenue_per_recipient, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        delivered             = VALUES(delivered),
        opens                 = VALUES(opens),
        opens_unique          = VALUES(opens_unique),
        open_rate             = VALUES(open_rate),
        clicks                = VALUES(clicks),
        clicks_unique         = VALUES(clicks_unique),
        click_rate            = VALUES(click_rate),
        unsubscribes          = VALUES(unsubscribes),
        bounces               = VALUES(bounces),
        conversions           = VALUES(conversions),
        conversion_rate       = VALUES(conversion_rate),
        conversion_value      = VALUES(conversion_value),
        revenue_per_recipient = VALUES(revenue_per_recipient),
        raw_data              = VALUES(raw_data),
        synced_at             = VALUES(synced_at)
    `;
    total += c.length;
  }
  return total;
}

export async function upsertProfiles(rows: ProfileInput[]): Promise<number> {
  let total = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map(
        (r) =>
          Prisma.sql`(${r.klaviyoId}, ${r.email}, ${r.phoneNumber}, ${r.firstName}, ${r.lastName}, ${r.emailConsent}, ${r.smsConsent}, ${r.country}, ${r.city}, ${r.region}, ${r.zip}, ${r.timezone}, ${r.lifecycleStage}, ${r.signupSource}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO klaviyo_profiles
        (klaviyo_id, email, phone_number, first_name, last_name, email_consent, sms_consent, country, city, region, zip, timezone, lifecycle_stage, signup_source, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        email           = VALUES(email),
        phone_number    = VALUES(phone_number),
        first_name      = VALUES(first_name),
        last_name       = VALUES(last_name),
        email_consent   = VALUES(email_consent),
        sms_consent     = VALUES(sms_consent),
        country         = VALUES(country),
        city            = VALUES(city),
        region          = VALUES(region),
        zip             = VALUES(zip),
        timezone        = VALUES(timezone),
        lifecycle_stage = VALUES(lifecycle_stage),
        signup_source   = VALUES(signup_source),
        src_created_at  = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data        = VALUES(raw_data),
        synced_at       = VALUES(synced_at)
    `;
    total += c.length;
  }
  return total;
}

export async function upsertEvents(rows: EventInput[]): Promise<number> {
  let total = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map(
        (r) =>
          Prisma.sql`(${r.klaviyoId}, ${r.metricId}, ${r.metricName}, ${r.profileId}, ${r.campaignId}, ${r.value}, ${r.eventDate}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO klaviyo_events
        (klaviyo_id, metric_id, metric_name, profile_id, campaign_id, value, event_date, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        metric_id   = VALUES(metric_id),
        metric_name = VALUES(metric_name),
        profile_id  = VALUES(profile_id),
        campaign_id = VALUES(campaign_id),
        value       = VALUES(value),
        event_date  = VALUES(event_date),
        raw_data    = VALUES(raw_data),
        synced_at   = VALUES(synced_at)
    `;
    total += c.length;
  }
  return total;
}

export async function upsertFlows(rows: FlowInput[]): Promise<number> {
  let total = 0;
  for (const c of chunk(rows, 200)) {
    const values = Prisma.join(
      c.map(
        (r) =>
          Prisma.sql`(${r.klaviyoId}, ${r.name}, ${r.status}, ${r.archived}, ${r.triggerType}, ${r.srcCreatedAt}, ${r.srcModifiedAt}, ${JSON.stringify(r.rawData)}, ${r.syncedAt})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO klaviyo_flows
        (klaviyo_id, name, status, archived, trigger_type, src_created_at, src_modified_at, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        name            = VALUES(name),
        status          = VALUES(status),
        archived        = VALUES(archived),
        trigger_type    = VALUES(trigger_type),
        src_created_at  = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at),
        raw_data        = VALUES(raw_data),
        synced_at       = VALUES(synced_at)
    `;
    total += c.length;
  }
  return total;
}
