import { transformProfile } from '../profileTransformer';
import { KlaviyoProfile } from '../../../types/klaviyo.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullProfile: KlaviyoProfile = {
  id: 'PROFILE-001',
  type: 'profile',
  attributes: {
    email: 'jane.doe@example.com',
    phone_number: '+14155550001',
    first_name: 'Jane',
    last_name: 'Doe',
    subscriptions: {
      email: { marketing: { consent: 'SUBSCRIBED' } },
      sms:   { marketing: { consent: 'SUBSCRIBED' } },
    },
    location: {
      country:  'US',
      city:     'San Francisco',
      region:   'CA',
      zip:      '94107',
      timezone: 'America/Los_Angeles',
    },
    properties: {
      lifecycle_stage: 'active',
      signup_source:   'homepage',
    },
    created: '2025-11-15T08:30:00+00:00',
    updated: '2026-03-20T14:45:00+00:00',
  },
};

describe('transformProfile', () => {
  it('maps all fields correctly from a full profile', () => {
    const result = transformProfile(fullProfile, SYNCED_AT);

    expect(result.klaviyoId).toBe('PROFILE-001');
    expect(result.email).toBe('jane.doe@example.com');
    expect(result.phoneNumber).toBe('+14155550001');
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.emailConsent).toBe('SUBSCRIBED');
    expect(result.smsConsent).toBe('SUBSCRIBED');
    expect(result.country).toBe('US');
    expect(result.city).toBe('San Francisco');
    expect(result.region).toBe('CA');
    expect(result.zip).toBe('94107');
    expect(result.timezone).toBe('America/Los_Angeles');
    expect(result.lifecycleStage).toBe('active');
    expect(result.signupSource).toBe('homepage');
    expect(result.srcCreatedAt).toEqual(new Date('2025-11-15T08:30:00+00:00'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-03-20T14:45:00+00:00'));
    expect(result.rawData).toBe(fullProfile);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('returns null emailConsent when subscriptions is null (BUG-KLV-06 fix)', () => {
    // This is the scenario when adapter does NOT request additional-fields[profile]=subscriptions
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: { ...fullProfile.attributes, subscriptions: null },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.emailConsent).toBeNull();
    expect(result.smsConsent).toBeNull();
  });

  it('returns null emailConsent when email marketing object is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: {
        ...fullProfile.attributes,
        subscriptions: { email: null, sms: { marketing: { consent: 'SUBSCRIBED' } } },
      },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.emailConsent).toBeNull();
    expect(result.smsConsent).toBe('SUBSCRIBED');
  });

  it('returns null smsConsent when sms marketing consent is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: {
        ...fullProfile.attributes,
        subscriptions: {
          email: { marketing: { consent: 'SUBSCRIBED' } },
          sms:   { marketing: { consent: null } },
        },
      },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.smsConsent).toBeNull();
  });

  it('returns null location fields when location is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: { ...fullProfile.attributes, location: null },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.country).toBeNull();
    expect(result.city).toBeNull();
    expect(result.region).toBeNull();
    expect(result.zip).toBeNull();
    expect(result.timezone).toBeNull();
  });

  it('returns null property fields when properties is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: { ...fullProfile.attributes, properties: null },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.lifecycleStage).toBeNull();
    expect(result.signupSource).toBeNull();
  });

  it('returns null srcCreatedAt when created is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: { ...fullProfile.attributes, created: null },
    };
    expect(transformProfile(profile, SYNCED_AT).srcCreatedAt).toBeNull();
  });

  it('returns null srcModifiedAt when updated is null', () => {
    const profile: KlaviyoProfile = {
      ...fullProfile,
      attributes: { ...fullProfile.attributes, updated: null },
    };
    expect(transformProfile(profile, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('handles profile with no optional fields', () => {
    const profile: KlaviyoProfile = {
      id: 'PROFILE-MIN',
      type: 'profile',
      attributes: {
        email: null,
        phone_number: null,
        first_name: null,
        last_name: null,
        subscriptions: null,
        location: null,
        properties: null,
        created: null,
        updated: null,
      },
    };
    const result = transformProfile(profile, SYNCED_AT);
    expect(result.klaviyoId).toBe('PROFILE-MIN');
    expect(result.email).toBeNull();
    expect(result.emailConsent).toBeNull();
    expect(result.smsConsent).toBeNull();
    expect(result.country).toBeNull();
    expect(result.lifecycleStage).toBeNull();
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
  });

  it('parses ISO 8601 dates to Date objects', () => {
    const result = transformProfile(fullProfile, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt?.getUTCFullYear()).toBe(2025);
    expect(result.srcModifiedAt?.getUTCFullYear()).toBe(2026);
  });
});
