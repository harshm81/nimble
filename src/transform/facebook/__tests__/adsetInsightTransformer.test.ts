import { transformAdsetInsight } from '../adsetInsightTransformer';
import { FacebookAdsetInsightRaw, FacebookAction } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const sampleActions: FacebookAction[] = [
  { action_type: 'purchase',          value: '18' },
  { action_type: 'add_to_cart',       value: '74' },
  { action_type: 'initiate_checkout', value: '39' },
  { action_type: 'landing_page_view', value: '510' },
  { action_type: 'link_click',        value: '620' },
];

const sampleActionValues: FacebookAction[] = [
  { action_type: 'purchase',    value: '1349.82' },
  { action_type: 'add_to_cart', value: '3710.00' },
];

const fullInsight: FacebookAdsetInsightRaw = {
  adset_id:      '23851234567890',
  adset_name:    'Retargeting — Cart Abandoners',
  campaign_id:   '6042147342661',
  campaign_name: 'Summer Sale 2026',
  date_start:    '2026-04-14',
  spend:         '98.45',
  impressions:   '4120',
  clicks:        '134',
  reach:         '3200',
  frequency:     '1.2875',
  ctr:           '3.2524',
  cpc:           '0.7347',
  cpm:           '23.8956',
  actions:       sampleActions,
  action_values: sampleActionValues,
};

describe('transformAdsetInsight', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);

    expect(result.adsetId).toBe('23851234567890');
    expect(result.adsetName).toBe('Retargeting — Cart Abandoners');
    expect(result.campaignId).toBe('6042147342661');
    expect(result.campaignName).toBe('Summer Sale 2026');
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
    expect(result.spend).toBe(98.45);
    expect(result.impressions).toBe(4120);
    expect(result.clicks).toBe(134);
    expect(result.reach).toBe(3200);
    expect(result.frequency).toBe(1.2875);
    expect(result.ctr).toBe(3.2524);
    expect(result.cpc).toBe(0.7347);
    expect(result.cpm).toBe(23.8956);
    expect(result.purchases).toBe(18);
    expect(result.addToCarts).toBe(74);
    expect(result.initiateCheckouts).toBe(39);
    expect(result.landingPageViews).toBe(510);
    expect(result.conversionsJson).toBe(sampleActions);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
    expect(result.rawData).toBe(fullInsight);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('spend is parsed with parseFloat from string', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.spend).toBe(98.45);
    expect(typeof result.spend).toBe('number');
  });

  it('impressions is parsed with parseInt from string', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.impressions).toBe(4120);
    expect(Number.isInteger(result.impressions)).toBe(true);
  });

  it('clicks is parsed with parseInt from string', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.clicks).toBe(134);
    expect(Number.isInteger(result.clicks)).toBe(true);
  });

  it('reach is parsed with parseInt from string', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.reach).toBe(3200);
    expect(Number.isInteger(result.reach)).toBe(true);
  });

  it('frequency is present and parsed as float', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.frequency).toBe(1.2875);
    expect(typeof result.frequency).toBe('number');
  });

  it('null frequency produces null frequency', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, frequency: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.frequency).toBeNull();
  });

  it('null ctr produces null ctr', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, ctr: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.ctr).toBeNull();
  });

  it('null cpc produces null cpc', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, cpc: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.cpc).toBeNull();
  });

  it('null cpm produces null cpm', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, cpm: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.cpm).toBeNull();
  });

  it('action extraction works correctly for all action types', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.purchases).toBe(18);
    expect(result.addToCarts).toBe(74);
    expect(result.initiateCheckouts).toBe(39);
    expect(result.landingPageViews).toBe(510);
  });

  it('missing action type returns 0', () => {
    const raw: FacebookAdsetInsightRaw = {
      ...fullInsight,
      actions: [{ action_type: 'link_click', value: '200' }],
    };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('null actions produces 0 for all action counts', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, actions: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('conversionsJson equals the raw actions array', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.conversionsJson).toBe(sampleActions);
  });

  it('null actions produces null conversionsJson', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, actions: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.conversionsJson).toBeNull();
  });

  it('conversionValuesJson equals the raw action_values array', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
  });

  it('null action_values produces null conversionValuesJson', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, action_values: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.conversionValuesJson).toBeNull();
  });

  it('missing date_start throws an error', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, date_start: null };
    expect(() => transformAdsetInsight(raw, SYNCED_AT)).toThrow(
      'Facebook adset insight missing required date_start',
    );
  });

  it('null adset_id falls back to empty string', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, adset_id: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.adsetId).toBe('');
  });

  it('null campaign_id produces null campaignId', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, campaign_id: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.campaignId).toBeNull();
  });

  it('null campaign_name produces null campaignName', () => {
    const raw: FacebookAdsetInsightRaw = { ...fullInsight, campaign_name: null };
    const result = transformAdsetInsight(raw, SYNCED_AT);
    expect(result.campaignName).toBeNull();
  });

  it('reportDate is parsed from date_start string to a Date', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.reportDate).toBeInstanceOf(Date);
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformAdsetInsight(fullInsight, SYNCED_AT);
    expect(result.rawData).toBe(fullInsight);
  });
});
