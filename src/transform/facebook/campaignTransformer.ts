import { FacebookCampaignRaw } from '../../types/facebook.types';
import { CampaignInput } from '../../db/repositories/facebookRepo';

export function transformCampaign(raw: FacebookCampaignRaw, syncedAt: Date): CampaignInput {
  if (!raw.id) throw new Error(`transformCampaign: missing id in API response — raw: ${JSON.stringify(raw)}`);
  return {
    campaignId:    raw.id,
    campaignName:  raw.name ?? null,
    status:        raw.status ?? null,
    objective:     raw.objective ?? null,
    rawData:       raw,
    syncedAt,
    srcCreatedAt:  raw.created_time ? new Date(raw.created_time) : null,
    srcModifiedAt: raw.updated_time ? new Date(raw.updated_time) : null,
  };
}
