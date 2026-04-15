import { Prisma } from '@prisma/client';
import { KlaviyoCampaignStatResult } from '../../types/klaviyo.types';
import { CampaignStatInput } from '../../db/repositories/klaviyoRepo';

export function transformCampaignStat(
  raw: KlaviyoCampaignStatResult,
  syncedAt: Date,
): CampaignStatInput {
  if (!raw.campaign_id) {
    throw new Error('transformCampaignStat: missing campaign_id in API response');
  }

  return {
    klaviyoId:           raw.campaign_id,
    delivered:           raw.delivered ?? null,
    opens:               raw.opens ?? null,
    opensUnique:         raw.unique_opens ?? null,      // API field: unique_opens
    openRate:            raw.open_rate != null ? new Prisma.Decimal(raw.open_rate) : null,
    clicks:              raw.clicks ?? null,
    clicksUnique:        raw.unique_clicks ?? null,     // API field: unique_clicks
    clickRate:           raw.click_rate != null ? new Prisma.Decimal(raw.click_rate) : null,
    unsubscribes:        raw.unsubscribes ?? null,
    bounces:             raw.bounced ?? null,           // API field: bounced
    conversions:         raw.conversions ?? null,
    conversionRate:      raw.conversion_rate != null ? new Prisma.Decimal(raw.conversion_rate) : null,
    conversionValue:     raw.conversion_value != null ? new Prisma.Decimal(raw.conversion_value) : null,
    revenuePerRecipient: raw.revenue_per_recipient != null ? new Prisma.Decimal(raw.revenue_per_recipient) : null,
    rawData:             raw,
    syncedAt,
  };
}
