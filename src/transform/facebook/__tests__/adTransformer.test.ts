import { transformAd } from '../adTransformer';
import { FacebookAdRaw } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullAd: FacebookAdRaw = {
  id:           '120213456789010',
  name:         'Carousel — Running Shoes',
  adset_id:     '23851234567890',
  campaign_id:  '6042147342661',
  status:       'ACTIVE',
  created_time: '2026-03-07T08:15:00+0000',
  updated_time: '2026-04-09T12:00:00+0000',
};

describe('transformAd', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformAd(fullAd, SYNCED_AT);

    expect(result.adId).toBe('120213456789010');
    expect(result.adName).toBe('Carousel — Running Shoes');
    expect(result.adsetId).toBe('23851234567890');
    expect(result.campaignId).toBe('6042147342661');
    expect(result.status).toBe('ACTIVE');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-07T08:15:00+0000'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-09T12:00:00+0000'));
    expect(result.rawData).toBe(fullAd);
  });

  it('srcCreatedAt parses from created_time string to Date', () => {
    const result = transformAd(fullAd, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-07T08:15:00+0000'));
  });

  it('srcModifiedAt parses from updated_time string to Date', () => {
    const result = transformAd(fullAd, SYNCED_AT);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-09T12:00:00+0000'));
  });

  it('null created_time produces null srcCreatedAt', () => {
    const raw: FacebookAdRaw = { ...fullAd, created_time: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('null updated_time produces null srcModifiedAt', () => {
    const raw: FacebookAdRaw = { ...fullAd, updated_time: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null id falls back to empty string', () => {
    const raw: FacebookAdRaw = { ...fullAd, id: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.adId).toBe('');
  });

  it('null adset_id produces null adsetId', () => {
    const raw: FacebookAdRaw = { ...fullAd, adset_id: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.adsetId).toBeNull();
  });

  it('null campaign_id produces null campaignId', () => {
    const raw: FacebookAdRaw = { ...fullAd, campaign_id: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.campaignId).toBeNull();
  });

  it('null name produces null adName', () => {
    const raw: FacebookAdRaw = { ...fullAd, name: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.adName).toBeNull();
  });

  it('null status produces null status', () => {
    const raw: FacebookAdRaw = { ...fullAd, status: null };
    const result = transformAd(raw, SYNCED_AT);
    expect(result.status).toBeNull();
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformAd(fullAd, SYNCED_AT);
    expect(result.rawData).toBe(fullAd);
  });

  it('syncedAt is passed through unchanged', () => {
    const result = transformAd(fullAd, SYNCED_AT);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });
});
