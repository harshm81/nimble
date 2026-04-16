import { Prisma } from '@prisma/client';
import { KlaviyoCampaignStatResult } from '../../types/klaviyo.types';
import { CampaignStatInput } from '../../db/repositories/klaviyoRepo';

export function transformCampaignStat(
  raw: KlaviyoCampaignStatResult,
  syncedAt: Date,
): CampaignStatInput {
  // revision 2026-04-15: campaign_id moved to groupings.campaign_id
  const campaignId = raw.groupings?.campaign_id ?? null;
  if (!campaignId) {
    throw new Error('transformCampaignStat: missing groupings.campaign_id in API response');
  }

  const s = raw.statistics;

  return {
    klaviyoId:           campaignId,
    delivered:           s.delivered ?? null,
    opens:               s.opens ?? null,
    opensUnique:         s.opens_unique ?? null,
    openRate:            s.open_rate != null ? new Prisma.Decimal(s.open_rate) : null,
    clicks:              s.clicks ?? null,
    clicksUnique:        s.clicks_unique ?? null,
    clickRate:           s.click_rate != null ? new Prisma.Decimal(s.click_rate) : null,
    unsubscribes:        s.unsubscribes ?? null,
    bounces:             s.bounced ?? null,
    conversions:         s.conversions ?? null,
    conversionRate:      s.conversion_rate != null ? new Prisma.Decimal(s.conversion_rate) : null,
    conversionValue:     s.conversion_value != null ? new Prisma.Decimal(s.conversion_value) : null,
    revenuePerRecipient: s.revenue_per_recipient != null ? new Prisma.Decimal(s.revenue_per_recipient) : null,
    rawData:             raw,
    syncedAt,
  };
}
