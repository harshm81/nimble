import { FacebookAdsetInsightRaw } from '../../types/facebook.types';
import { AdsetInsightInput, extractAction } from '../../db/repositories/facebookRepo';

export function transformAdsetInsight(raw: FacebookAdsetInsightRaw, syncedAt: Date): AdsetInsightInput {
  return {
    adsetId:              raw.adset_id      ?? '',
    adsetName:            raw.adset_name    ?? null,
    campaignId:           raw.campaign_id   ?? null,
    campaignName:         raw.campaign_name ?? null,
    reportDate:           raw.date_start ? new Date(raw.date_start) : (() => { throw new Error('Facebook adset insight missing required date_start'); })(),
    spend:                raw.spend         ? parseFloat(raw.spend)        : 0,
    impressions:          raw.impressions   ? parseInt(raw.impressions, 10) : 0,
    clicks:               raw.clicks        ? parseInt(raw.clicks, 10)      : 0,
    reach:                raw.reach         ? parseInt(raw.reach, 10)       : 0,
    frequency:            raw.frequency     ? parseFloat(raw.frequency)     : null,
    ctr:                  raw.ctr           ? parseFloat(raw.ctr)           : null,
    cpc:                  raw.cpc           ? parseFloat(raw.cpc)           : null,
    cpm:                  raw.cpm           ? parseFloat(raw.cpm)           : null,
    purchases:            extractAction(raw.actions, 'purchase'),
    addToCarts:           extractAction(raw.actions, 'add_to_cart'),
    initiateCheckouts:    extractAction(raw.actions, 'initiate_checkout'),
    landingPageViews:     extractAction(raw.actions, 'landing_page_view'),
    conversionsJson:      raw.actions       ?? null,
    conversionValuesJson: raw.action_values ?? null,
    rawData:              raw,
    syncedAt,
  };
}
