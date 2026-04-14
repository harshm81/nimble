import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { chunk } from '../../utils/chunk';

// ─── Input Interfaces ──────────────────────────────────────────────────────

export interface CampaignInput {
  campaignId:    string;
  campaignName:  string | null;
  status:        string | null;
  objective:     string | null;
  rawData:       object;
  syncedAt:      Date;
  srcCreatedAt:  Date | null;
  srcModifiedAt: Date | null;
}

export interface AdsetInput {
  adsetId:        string;
  adsetName:      string | null;
  campaignId:     string | null;
  status:         string | null;
  dailyBudget:    number | null;
  lifetimeBudget: number | null;
  rawData:        object;
  syncedAt:       Date;
  srcCreatedAt:   Date | null;
  srcModifiedAt:  Date | null;
}

export interface AdInput {
  adId:          string;
  adName:        string | null;
  adsetId:       string | null;
  campaignId:    string | null;
  status:        string | null;
  rawData:       object;
  syncedAt:      Date;
  srcCreatedAt:  Date | null;
  srcModifiedAt: Date | null;
}

export interface CampaignInsightInput {
  campaignId:           string;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  frequency:            number | null;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

export interface AdsetInsightInput {
  adsetId:              string;
  adsetName:            string | null;
  campaignId:           string | null;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  frequency:            number | null;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

export interface AdInsightInput {
  adId:                 string;
  adName:               string | null;
  adsetId:              string | null;
  adsetName:            string | null;
  campaignId:           string | null;
  campaignName:         string | null;
  reportDate:           Date;
  spend:                number;
  impressions:          number;
  clicks:               number;
  reach:                number;
  ctr:                  number | null;
  cpc:                  number | null;
  cpm:                  number | null;
  purchases:            number;
  addToCarts:           number;
  initiateCheckouts:    number;
  landingPageViews:     number;
  conversionsJson:      object | null;
  conversionValuesJson: object | null;
  rawData:              object;
  syncedAt:             Date;
}

// ─── Shared Helper ─────────────────────────────────────────────────────────

export function extractAction(
  actions: Array<{ action_type: string | null; value: string | null }> | null,
  actionType: string,
): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === actionType);
  return match?.value ? parseInt(match.value, 10) : 0;
}

// ─── Upsert Functions ──────────────────────────────────────────────────────

export async function upsertCampaigns(rows: CampaignInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.campaignId},
          ${r.campaignName},
          ${r.status},
          ${r.objective},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt},
          ${r.srcCreatedAt},
          ${r.srcModifiedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_campaigns
        (campaign_id, campaign_name, status, objective, raw_data, synced_at, src_created_at, src_modified_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        campaign_name  = VALUES(campaign_name),
        status         = VALUES(status),
        objective      = VALUES(objective),
        raw_data       = VALUES(raw_data),
        synced_at      = VALUES(synced_at),
        src_created_at = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at)
    `;
    saved += batch.length;
  }
  return saved;
}

export async function upsertAdsets(rows: AdsetInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.adsetId},
          ${r.adsetName},
          ${r.campaignId},
          ${r.status},
          ${r.dailyBudget},
          ${r.lifetimeBudget},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt},
          ${r.srcCreatedAt},
          ${r.srcModifiedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_adsets
        (adset_id, adset_name, campaign_id, status, daily_budget, lifetime_budget, raw_data, synced_at, src_created_at, src_modified_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        adset_name      = VALUES(adset_name),
        campaign_id     = VALUES(campaign_id),
        status          = VALUES(status),
        daily_budget    = VALUES(daily_budget),
        lifetime_budget = VALUES(lifetime_budget),
        raw_data        = VALUES(raw_data),
        synced_at       = VALUES(synced_at),
        src_created_at  = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at)
    `;
    saved += batch.length;
  }
  return saved;
}

export async function upsertAds(rows: AdInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.adId},
          ${r.adName},
          ${r.adsetId},
          ${r.campaignId},
          ${r.status},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt},
          ${r.srcCreatedAt},
          ${r.srcModifiedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_ads
        (ad_id, ad_name, adset_id, campaign_id, status, raw_data, synced_at, src_created_at, src_modified_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        ad_name         = VALUES(ad_name),
        adset_id        = VALUES(adset_id),
        campaign_id     = VALUES(campaign_id),
        status          = VALUES(status),
        raw_data        = VALUES(raw_data),
        synced_at       = VALUES(synced_at),
        src_created_at  = VALUES(src_created_at),
        src_modified_at = VALUES(src_modified_at)
    `;
    saved += batch.length;
  }
  return saved;
}

export async function upsertCampaignInsights(rows: CampaignInsightInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.campaignId},
          ${r.campaignName},
          ${r.reportDate},
          ${r.spend},
          ${r.impressions},
          ${r.clicks},
          ${r.reach},
          ${r.frequency},
          ${r.ctr},
          ${r.cpc},
          ${r.cpm},
          ${r.purchases},
          ${r.addToCarts},
          ${r.initiateCheckouts},
          ${r.landingPageViews},
          ${r.conversionsJson ? JSON.stringify(r.conversionsJson) : null},
          ${r.conversionValuesJson ? JSON.stringify(r.conversionValuesJson) : null},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_campaign_insights
        (campaign_id, campaign_name, report_date, spend, impressions, clicks, reach,
         frequency, ctr, cpc, cpm, purchases, add_to_carts, initiate_checkouts,
         landing_page_views, conversions_json, conversion_values_json, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        campaign_name          = VALUES(campaign_name),
        spend                  = VALUES(spend),
        impressions            = VALUES(impressions),
        clicks                 = VALUES(clicks),
        reach                  = VALUES(reach),
        frequency              = VALUES(frequency),
        ctr                    = VALUES(ctr),
        cpc                    = VALUES(cpc),
        cpm                    = VALUES(cpm),
        purchases              = VALUES(purchases),
        add_to_carts           = VALUES(add_to_carts),
        initiate_checkouts     = VALUES(initiate_checkouts),
        landing_page_views     = VALUES(landing_page_views),
        conversions_json       = VALUES(conversions_json),
        conversion_values_json = VALUES(conversion_values_json),
        raw_data               = VALUES(raw_data),
        synced_at              = VALUES(synced_at)
    `;
    saved += batch.length;
  }
  return saved;
}

export async function upsertAdsetInsights(rows: AdsetInsightInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.adsetId},
          ${r.adsetName},
          ${r.campaignId},
          ${r.campaignName},
          ${r.reportDate},
          ${r.spend},
          ${r.impressions},
          ${r.clicks},
          ${r.reach},
          ${r.frequency},
          ${r.ctr},
          ${r.cpc},
          ${r.cpm},
          ${r.purchases},
          ${r.addToCarts},
          ${r.initiateCheckouts},
          ${r.landingPageViews},
          ${r.conversionsJson ? JSON.stringify(r.conversionsJson) : null},
          ${r.conversionValuesJson ? JSON.stringify(r.conversionValuesJson) : null},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_adset_insights
        (adset_id, adset_name, campaign_id, campaign_name, report_date, spend, impressions,
         clicks, reach, frequency, ctr, cpc, cpm, purchases, add_to_carts, initiate_checkouts,
         landing_page_views, conversions_json, conversion_values_json, raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        adset_name             = VALUES(adset_name),
        campaign_id            = VALUES(campaign_id),
        campaign_name          = VALUES(campaign_name),
        spend                  = VALUES(spend),
        impressions            = VALUES(impressions),
        clicks                 = VALUES(clicks),
        reach                  = VALUES(reach),
        frequency              = VALUES(frequency),
        ctr                    = VALUES(ctr),
        cpc                    = VALUES(cpc),
        cpm                    = VALUES(cpm),
        purchases              = VALUES(purchases),
        add_to_carts           = VALUES(add_to_carts),
        initiate_checkouts     = VALUES(initiate_checkouts),
        landing_page_views     = VALUES(landing_page_views),
        conversions_json       = VALUES(conversions_json),
        conversion_values_json = VALUES(conversion_values_json),
        raw_data               = VALUES(raw_data),
        synced_at              = VALUES(synced_at)
    `;
    saved += batch.length;
  }
  return saved;
}

export async function upsertAdInsights(rows: AdInsightInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  let saved = 0;
  for (const batch of chunk(rows, 200)) {
    const values = Prisma.join(
      batch.map((r) =>
        Prisma.sql`(
          ${r.adId},
          ${r.adName},
          ${r.adsetId},
          ${r.adsetName},
          ${r.campaignId},
          ${r.campaignName},
          ${r.reportDate},
          ${r.spend},
          ${r.impressions},
          ${r.clicks},
          ${r.reach},
          ${r.ctr},
          ${r.cpc},
          ${r.cpm},
          ${r.purchases},
          ${r.addToCarts},
          ${r.initiateCheckouts},
          ${r.landingPageViews},
          ${r.conversionsJson ? JSON.stringify(r.conversionsJson) : null},
          ${r.conversionValuesJson ? JSON.stringify(r.conversionValuesJson) : null},
          ${JSON.stringify(r.rawData)},
          ${r.syncedAt}
        )`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO facebook_ad_insights
        (ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, report_date,
         spend, impressions, clicks, reach, ctr, cpc, cpm, purchases, add_to_carts,
         initiate_checkouts, landing_page_views, conversions_json, conversion_values_json,
         raw_data, synced_at)
      VALUES ${values}
      ON DUPLICATE KEY UPDATE
        ad_name                = VALUES(ad_name),
        adset_id               = VALUES(adset_id),
        adset_name             = VALUES(adset_name),
        campaign_id            = VALUES(campaign_id),
        campaign_name          = VALUES(campaign_name),
        spend                  = VALUES(spend),
        impressions            = VALUES(impressions),
        clicks                 = VALUES(clicks),
        reach                  = VALUES(reach),
        ctr                    = VALUES(ctr),
        cpc                    = VALUES(cpc),
        cpm                    = VALUES(cpm),
        purchases              = VALUES(purchases),
        add_to_carts           = VALUES(add_to_carts),
        initiate_checkouts     = VALUES(initiate_checkouts),
        landing_page_views     = VALUES(landing_page_views),
        conversions_json       = VALUES(conversions_json),
        conversion_values_json = VALUES(conversion_values_json),
        raw_data               = VALUES(raw_data),
        synced_at              = VALUES(synced_at)
    `;
    saved += batch.length;
  }
  return saved;
}
