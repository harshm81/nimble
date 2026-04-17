import { FacebookAdRaw } from '../../types/facebook.types';
import { AdInput } from '../../db/repositories/facebookRepo';

export function transformAd(raw: FacebookAdRaw, syncedAt: Date): AdInput {
  if (!raw.id) throw new Error(`transformAd: missing id in API response — raw: ${JSON.stringify(raw)}`);
  return {
    adId:          raw.id,
    adName:        raw.name ?? null,
    adsetId:       raw.adset_id ?? null,
    campaignId:    raw.campaign_id ?? null,
    status:        raw.status ?? null,
    rawData:       raw,
    syncedAt,
    srcCreatedAt:  raw.created_time ? new Date(raw.created_time) : null,
    srcModifiedAt: raw.updated_time ? new Date(raw.updated_time) : null,
  };
}
