import { KlaviyoCampaign } from '../../types/klaviyo.types';
import { CampaignInput } from '../../db/repositories/klaviyoRepo';

export function transformCampaign(
  raw: KlaviyoCampaign,
  syncedAt: Date,
): CampaignInput {
  return {
    klaviyoId:     raw.id,
    name:          raw.attributes.name ?? null,
    status:        raw.attributes.status ?? null,
    channel:       raw.attributes.channel ?? null,
    sendTime:      raw.attributes.send_time ? new Date(raw.attributes.send_time) : null,
    srcCreatedAt:  raw.attributes.created_at ? new Date(raw.attributes.created_at) : null,
    srcModifiedAt: raw.attributes.updated_at ? new Date(raw.attributes.updated_at) : null,
    rawData:       raw,
    syncedAt,
  };
}
