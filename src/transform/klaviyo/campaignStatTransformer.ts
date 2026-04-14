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
    opensUnique:         raw.opens_unique ?? null,
    openRate:            raw.open_rate ?? null,
    clicks:              raw.clicks ?? null,
    clicksUnique:        raw.clicks_unique ?? null,
    clickRate:           raw.click_rate ?? null,
    unsubscribes:        raw.unsubscribes ?? null,
    bounces:             raw.bounces ?? null,
    conversions:         raw.conversions ?? null,
    conversionRate:      raw.conversion_rate ?? null,
    conversionValue:     raw.conversion_value ?? null,
    revenuePerRecipient: raw.revenue_per_recipient ?? null,
    rawData:             raw,
    syncedAt,
  };
}
