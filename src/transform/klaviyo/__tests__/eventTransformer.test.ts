import { Prisma } from '@prisma/client';
import { transformEvent } from '../eventTransformer';
import { KlaviyoEvent } from '../../../types/klaviyo.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullEvent: KlaviyoEvent = {
  id: 'EVENT-001',
  type: 'event',
  attributes: {
    value:       49.99,
    datetime:    '2026-04-14T13:22:00+00:00',
    metric_name: 'Placed Order',
    properties:  {
      $attributed_message: 'MSG-001',
      $attributed_flow:    null,
    },
  },
  relationships: {
    metric:  { data: { id: 'METRIC-001', type: 'metric' } },
    profile: { data: { id: 'PROFILE-001', type: 'profile' } },
  },
};

describe('transformEvent', () => {
  it('maps all fields correctly from a full event', () => {
    const result = transformEvent(fullEvent, SYNCED_AT);

    expect(result.klaviyoId).toBe('EVENT-001');
    expect(result.metricId).toBe('METRIC-001');
    expect(result.metricName).toBe('Placed Order');
    expect(result.profileId).toBe('PROFILE-001');
    expect(result.messageId).toBe('MSG-001');
    expect(result.eventDate).toEqual(new Date('2026-04-14T13:22:00+00:00'));
    expect(result.rawData).toBe(fullEvent);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('wraps value as Prisma.Decimal (BUG-KLV-09 fix)', () => {
    const result = transformEvent(fullEvent, SYNCED_AT);
    expect(result.value).toBeInstanceOf(Prisma.Decimal);
    expect(result.value?.toString()).toBe('49.99');
  });

  it('maps messageId from $attributed_message (BUG-KLV-07 fix — not a campaignId)', () => {
    // $attributed_message is a message ID, not a campaign ID
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: {
        ...fullEvent.attributes,
        properties: { $attributed_message: 'MSG-XYZ' },
      },
    };
    const result = transformEvent(event, SYNCED_AT);
    expect(result.messageId).toBe('MSG-XYZ');
  });

  it('returns null messageId when $attributed_message is absent', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, properties: {} },
    };
    expect(transformEvent(event, SYNCED_AT).messageId).toBeNull();
  });

  it('returns null messageId when properties is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, properties: null },
    };
    expect(transformEvent(event, SYNCED_AT).messageId).toBeNull();
  });

  it('returns null value when API value is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, value: null },
    };
    expect(transformEvent(event, SYNCED_AT).value).toBeNull();
  });

  it('returns null eventDate when datetime is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, datetime: null },
    };
    expect(transformEvent(event, SYNCED_AT).eventDate).toBeNull();
  });

  it('returns null metricId when relationships is null', () => {
    const event: KlaviyoEvent = { ...fullEvent, relationships: null };
    expect(transformEvent(event, SYNCED_AT).metricId).toBeNull();
    expect(transformEvent(event, SYNCED_AT).profileId).toBeNull();
  });

  it('returns null metricId when metric data is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      relationships: {
        metric:  { data: null },
        profile: { data: { id: 'PROFILE-001', type: 'profile' } },
      },
    };
    expect(transformEvent(event, SYNCED_AT).metricId).toBeNull();
  });

  it('returns null profileId when profile data is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      relationships: {
        metric:  { data: { id: 'METRIC-001', type: 'metric' } },
        profile: { data: null },
      },
    };
    expect(transformEvent(event, SYNCED_AT).profileId).toBeNull();
  });

  it('returns null metricName when metric_name is null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, metric_name: null },
    };
    expect(transformEvent(event, SYNCED_AT).metricName).toBeNull();
  });

  it('handles zero value without treating it as null', () => {
    const event: KlaviyoEvent = {
      ...fullEvent,
      attributes: { ...fullEvent.attributes, value: 0 },
    };
    const result = transformEvent(event, SYNCED_AT);
    expect(result.value).toBeInstanceOf(Prisma.Decimal);
    expect(result.value?.toString()).toBe('0');
  });

  it('parses eventDate as UTC Date', () => {
    const result = transformEvent(fullEvent, SYNCED_AT);
    expect(result.eventDate).toBeInstanceOf(Date);
    expect(result.eventDate?.getUTCFullYear()).toBe(2026);
    expect(result.eventDate?.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(result.eventDate?.getUTCDate()).toBe(14);
  });
});
