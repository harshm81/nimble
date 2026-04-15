import { Prisma } from '@prisma/client';
import { KlaviyoEvent } from '../../types/klaviyo.types';
import { EventInput } from '../../db/repositories/klaviyoRepo';

export function transformEvent(
  raw: KlaviyoEvent,
  syncedAt: Date,
): EventInput {
  return {
    klaviyoId:  raw.id,
    metricId:   raw.relationships?.metric?.data?.id  ?? null,
    metricName: raw.attributes.metric_name ?? null,
    profileId:  raw.relationships?.profile?.data?.id ?? null,
    messageId:  raw.attributes.properties?.$attributed_message ?? null,
    value:      raw.attributes.value != null ? new Prisma.Decimal(raw.attributes.value) : null,
    eventDate:  raw.attributes.datetime ? new Date(raw.attributes.datetime) : null,
    rawData:    raw,
    syncedAt,
  };
}
