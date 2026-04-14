import { KlaviyoProfile } from '../../types/klaviyo.types';
import { ProfileInput } from '../../db/repositories/klaviyoRepo';

export function transformProfile(
  raw: KlaviyoProfile,
  syncedAt: Date,
): ProfileInput {
  return {
    klaviyoId:      raw.id,
    email:          raw.attributes.email ?? null,
    phoneNumber:    raw.attributes.phone_number ?? null,
    firstName:      raw.attributes.first_name ?? null,
    lastName:       raw.attributes.last_name ?? null,

    emailConsent:   raw.attributes.subscriptions?.email?.marketing?.consent ?? null,
    smsConsent:     raw.attributes.subscriptions?.sms?.marketing?.consent ?? null,

    country:        raw.attributes.location?.country ?? null,
    city:           raw.attributes.location?.city ?? null,
    region:         raw.attributes.location?.region ?? null,
    zip:            raw.attributes.location?.zip ?? null,
    timezone:       raw.attributes.location?.timezone ?? null,

    lifecycleStage: raw.attributes.properties?.lifecycle_stage ?? null,
    signupSource:   raw.attributes.properties?.signup_source ?? null,

    srcCreatedAt:   raw.attributes.created ? new Date(raw.attributes.created) : null,
    srcModifiedAt:  raw.attributes.updated ? new Date(raw.attributes.updated) : null,

    rawData:        raw,
    syncedAt,
  };
}
