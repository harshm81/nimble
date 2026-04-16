import { transformAdset } from '../adsetTransformer';
import { FacebookAdsetRaw } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullAdset: FacebookAdsetRaw = {
  id:              '23851234567890',
  name:            'Retargeting — Cart Abandoners',
  campaign_id:     '6042147342661',
  status:          'ACTIVE',
  daily_budget:    '5000',
  lifetime_budget: '150000',
  created_time:    '2026-03-05T11:00:00+0000',
  updated_time:    '2026-04-08T16:45:00+0000',
};

describe('transformAdset', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformAdset(fullAdset, SYNCED_AT);

    expect(result.adsetId).toBe('23851234567890');
    expect(result.adsetName).toBe('Retargeting — Cart Abandoners');
    expect(result.campaignId).toBe('6042147342661');
    expect(result.status).toBe('ACTIVE');
    expect(result.dailyBudget).toBe(50.00);
    expect(result.lifetimeBudget).toBe(1500.00);
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-05T11:00:00+0000'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-08T16:45:00+0000'));
    expect(result.rawData).toBe(fullAdset);
  });

  it('dailyBudget divides API cents string by 100', () => {
    // API returns '5000' meaning 5000 cents = $50.00
    const result = transformAdset(fullAdset, SYNCED_AT);
    expect(result.dailyBudget).toBe(50.00);
  });

  it('lifetimeBudget divides API cents string by 100', () => {
    // API returns '150000' meaning 150000 cents = $1500.00
    const result = transformAdset(fullAdset, SYNCED_AT);
    expect(result.lifetimeBudget).toBe(1500.00);
  });

  it('null daily_budget produces null dailyBudget', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, daily_budget: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.dailyBudget).toBeNull();
  });

  it('null lifetime_budget produces null lifetimeBudget', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, lifetime_budget: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.lifetimeBudget).toBeNull();
  });

  it('srcCreatedAt parses from created_time string to Date', () => {
    const result = transformAdset(fullAdset, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-05T11:00:00+0000'));
  });

  it('srcModifiedAt parses from updated_time string to Date', () => {
    const result = transformAdset(fullAdset, SYNCED_AT);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-08T16:45:00+0000'));
  });

  it('null created_time produces null srcCreatedAt', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, created_time: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('null updated_time produces null srcModifiedAt', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, updated_time: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null id falls back to empty string', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, id: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.adsetId).toBe('');
  });

  it('null campaign_id produces null campaignId', () => {
    const raw: FacebookAdsetRaw = { ...fullAdset, campaign_id: null };
    const result = transformAdset(raw, SYNCED_AT);
    expect(result.campaignId).toBeNull();
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformAdset(fullAdset, SYNCED_AT);
    expect(result.rawData).toBe(fullAdset);
  });
});
