import { KlaviyoFlow } from '../../types/klaviyo.types';
import { FlowInput } from '../../db/repositories/klaviyoRepo';

export function transformFlow(
  raw: KlaviyoFlow,
  syncedAt: Date,
): FlowInput {
  return {
    klaviyoId:     raw.id,
    name:          raw.attributes.name ?? null,
    status:        raw.attributes.status ?? null,
    archived:      raw.attributes.archived ?? null,
    triggerType:   raw.attributes.trigger_type ?? null,

    srcCreatedAt:  raw.attributes.created ? new Date(raw.attributes.created) : null,
    srcModifiedAt: raw.attributes.updated ? new Date(raw.attributes.updated) : null,

    rawData:       raw,
    syncedAt,
  };
}
