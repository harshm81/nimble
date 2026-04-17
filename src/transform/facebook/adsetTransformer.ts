import { FacebookAdsetRaw } from '../../types/facebook.types';
import { AdsetInput } from '../../db/repositories/facebookRepo';

export function transformAdset(raw: FacebookAdsetRaw, syncedAt: Date): AdsetInput {
  if (!raw.id) throw new Error(`transformAdset: missing id in API response — raw: ${JSON.stringify(raw)}`);
  return {
    adsetId:        raw.id,
    adsetName:      raw.name ?? null,
    campaignId:     raw.campaign_id ?? null,
    status:         raw.status ?? null,
    dailyBudget:    raw.daily_budget    ? parseFloat(raw.daily_budget) / 100    : null,
    lifetimeBudget: raw.lifetime_budget ? parseFloat(raw.lifetime_budget) / 100 : null,
    rawData:        raw,
    syncedAt,
    srcCreatedAt:  raw.created_time ? new Date(raw.created_time) : null,
    srcModifiedAt: raw.updated_time ? new Date(raw.updated_time) : null,
  };
}
