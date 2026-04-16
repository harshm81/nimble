import { transformCampaign } from '../campaignTransformer';
import { FacebookCampaignRaw } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullCampaign: FacebookCampaignRaw = {
  id:           '6042147342661',
  name:         'Summer Sale 2026',
  status:       'ACTIVE',
  objective:    'OUTCOME_SALES',
  created_time: '2026-03-01T09:00:00+0000',
  updated_time: '2026-04-10T14:30:00+0000',
};

describe('transformCampaign', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);

    expect(result.campaignId).toBe('6042147342661');
    expect(result.campaignName).toBe('Summer Sale 2026');
    expect(result.status).toBe('ACTIVE');
    expect(result.objective).toBe('OUTCOME_SALES');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-01T09:00:00+0000'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T14:30:00+0000'));
    expect(result.rawData).toBe(fullCampaign);
  });

  it('srcCreatedAt parses from created_time string to Date', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-01T09:00:00+0000'));
  });

  it('srcModifiedAt parses from updated_time string to Date', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T14:30:00+0000'));
  });

  it('null created_time produces null srcCreatedAt', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, created_time: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('null updated_time produces null srcModifiedAt', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, updated_time: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null id falls back to empty string', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, id: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.campaignId).toBe('');
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);
    expect(result.rawData).toBe(fullCampaign);
  });

  it('null name produces null campaignName', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, name: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.campaignName).toBeNull();
  });

  it('null status produces null status', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, status: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.status).toBeNull();
  });

  it('null objective produces null objective', () => {
    const raw: FacebookCampaignRaw = { ...fullCampaign, objective: null };
    const result = transformCampaign(raw, SYNCED_AT);
    expect(result.objective).toBeNull();
  });

  it('syncedAt is passed through unchanged', () => {
    const result = transformCampaign(fullCampaign, SYNCED_AT);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });
});
