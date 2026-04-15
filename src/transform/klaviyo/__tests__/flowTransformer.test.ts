import { transformFlow } from '../flowTransformer';
import { KlaviyoFlow } from '../../../types/klaviyo.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullFlow: KlaviyoFlow = {
  id: 'FLOW-001',
  type: 'flow',
  attributes: {
    name:         'Welcome Series',
    status:       'live',
    archived:     false,
    trigger_type: 'Added to List',
    created:      '2025-08-01T10:00:00+00:00',
    updated:      '2026-02-14T16:30:00+00:00',
  },
};

describe('transformFlow', () => {
  it('maps all fields correctly from a full flow', () => {
    const result = transformFlow(fullFlow, SYNCED_AT);

    expect(result.klaviyoId).toBe('FLOW-001');
    expect(result.name).toBe('Welcome Series');
    expect(result.status).toBe('live');
    expect(result.archived).toBe(false);
    expect(result.triggerType).toBe('Added to List');
    expect(result.srcCreatedAt).toEqual(new Date('2025-08-01T10:00:00+00:00'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-02-14T16:30:00+00:00'));
    expect(result.rawData).toBe(fullFlow);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('returns null name when name is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, name: null },
    };
    expect(transformFlow(flow, SYNCED_AT).name).toBeNull();
  });

  it('returns null status when status is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, status: null },
    };
    expect(transformFlow(flow, SYNCED_AT).status).toBeNull();
  });

  it('returns null archived when archived is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, archived: null },
    };
    expect(transformFlow(flow, SYNCED_AT).archived).toBeNull();
  });

  it('correctly stores archived = true', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, archived: true },
    };
    expect(transformFlow(flow, SYNCED_AT).archived).toBe(true);
  });

  it('returns null triggerType when trigger_type is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, trigger_type: null },
    };
    expect(transformFlow(flow, SYNCED_AT).triggerType).toBeNull();
  });

  it('returns null srcCreatedAt when created is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, created: null },
    };
    expect(transformFlow(flow, SYNCED_AT).srcCreatedAt).toBeNull();
  });

  it('returns null srcModifiedAt when updated is null', () => {
    const flow: KlaviyoFlow = {
      ...fullFlow,
      attributes: { ...fullFlow.attributes, updated: null },
    };
    expect(transformFlow(flow, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('parses ISO 8601 dates to Date objects', () => {
    const result = transformFlow(fullFlow, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt?.getUTCFullYear()).toBe(2025);
    expect(result.srcModifiedAt?.getUTCFullYear()).toBe(2026);
    expect(result.srcModifiedAt?.getUTCMonth()).toBe(1); // February (0-indexed)
  });

  it('handles flow with all nullable fields set to null', () => {
    const flow: KlaviyoFlow = {
      id: 'FLOW-MIN',
      type: 'flow',
      attributes: {
        name: null,
        status: null,
        archived: null,
        trigger_type: null,
        created: null,
        updated: null,
      },
    };
    const result = transformFlow(flow, SYNCED_AT);
    expect(result.klaviyoId).toBe('FLOW-MIN');
    expect(result.name).toBeNull();
    expect(result.status).toBeNull();
    expect(result.archived).toBeNull();
    expect(result.triggerType).toBeNull();
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
    expect(result.syncedAt).toBe(SYNCED_AT);
  });
});
