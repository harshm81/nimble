import { transformCampaign } from '../campaignTransformer';
import { KlaviyoCampaign } from '../../../types/klaviyo.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullCampaign: KlaviyoCampaign = {
  id: 'CAMPAIGN-001',
  type: 'campaign',
  attributes: {
    name: 'Spring Sale 2026',
    status: 'Sent',
    _channel: 'email',
    send_time: '2026-04-10T09:00:00+00:00',
    created_at: '2026-04-01T10:00:00+00:00',
    updated_at: '2026-04-10T09:05:00+00:00',
    audiences: null,
    send_options: null,
  },
  relationships: {
    'campaign-messages': {
      data: [{ id: 'MSG-001', type: 'campaign-message' }],
    },
  },
};

describe('transformCampaign', () => {
  it('maps all fields correctly from a full campaign', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);

    expect(result.klaviyoId).toBe('CAMPAIGN-001');
    expect(result.name).toBe('Spring Sale 2026');
    expect(result.status).toBe('Sent');
    expect(result.channel).toBe('email');
    expect(result.sendTime).toEqual(new Date('2026-04-10T09:00:00+00:00'));
    expect(result.srcCreatedAt).toEqual(new Date('2026-04-01T10:00:00+00:00'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T09:05:00+00:00'));
    expect(result.rawData).toBe(fullCampaign);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('returns null channel when _channel is null (BUG-KLV-02 fix)', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, _channel: null },
    };
    const result = transformCampaign(campaign, SYNCED_AT);
    expect(result.channel).toBeNull();
  });

  it('returns null name when name is null', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, name: null },
    };
    expect(transformCampaign(campaign, SYNCED_AT).name).toBeNull();
  });

  it('returns null status when status is null', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, status: null },
    };
    expect(transformCampaign(campaign, SYNCED_AT).status).toBeNull();
  });

  it('returns null sendTime when send_time is null', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, send_time: null },
    };
    expect(transformCampaign(campaign, SYNCED_AT).sendTime).toBeNull();
  });

  it('returns null srcCreatedAt when created_at is null', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, created_at: null },
    };
    expect(transformCampaign(campaign, SYNCED_AT).srcCreatedAt).toBeNull();
  });

  it('returns null srcModifiedAt when updated_at is null', () => {
    const campaign: KlaviyoCampaign = {
      ...fullCampaign,
      attributes: { ...fullCampaign.attributes, updated_at: null },
    };
    expect(transformCampaign(campaign, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('parses ISO 8601 date strings to Date objects', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);
    expect(result.sendTime).toBeInstanceOf(Date);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.sendTime?.getUTCFullYear()).toBe(2026);
    expect(result.sendTime?.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(result.sendTime?.getUTCDate()).toBe(10);
  });
});
