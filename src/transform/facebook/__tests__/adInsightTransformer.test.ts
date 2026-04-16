import { transformAdInsight } from '../adInsightTransformer';
import { FacebookAdInsightRaw, FacebookAction } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const sampleActions: FacebookAction[] = [
  { action_type: 'purchase',          value: '7' },
  { action_type: 'add_to_cart',       value: '31' },
  { action_type: 'initiate_checkout', value: '15' },
  { action_type: 'landing_page_view', value: '198' },
  { action_type: 'link_click',        value: '240' },
];

const sampleActionValues: FacebookAction[] = [
  { action_type: 'purchase',    value: '524.93' },
  { action_type: 'add_to_cart', value: '1480.50' },
];

const fullInsight: FacebookAdInsightRaw = {
  ad_id:         '120213456789010',
  ad_name:       'Carousel — Running Shoes',
  adset_id:      '23851234567890',
  adset_name:    'Retargeting — Cart Abandoners',
  campaign_id:   '6042147342661',
  campaign_name: 'Summer Sale 2026',
  date_start:    '2026-04-14',
  spend:         '41.20',
  impressions:   '1850',
  clicks:        '58',
  reach:         '1420',
  frequency:     '1.3028',
  ctr:           '3.1351',
  cpc:           '0.7103',
  cpm:           '22.2703',
  actions:       sampleActions,
  action_values: sampleActionValues,
};

describe('transformAdInsight', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);

    expect(result.adId).toBe('120213456789010');
    expect(result.adName).toBe('Carousel — Running Shoes');
    expect(result.adsetId).toBe('23851234567890');
    expect(result.adsetName).toBe('Retargeting — Cart Abandoners');
    expect(result.campaignId).toBe('6042147342661');
    expect(result.campaignName).toBe('Summer Sale 2026');
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
    expect(result.spend).toBe(41.20);
    expect(result.impressions).toBe(1850);
    expect(result.clicks).toBe(58);
    expect(result.reach).toBe(1420);
    expect(result.frequency).toBe(1.3028);
    expect(result.ctr).toBe(3.1351);
    expect(result.cpc).toBe(0.7103);
    expect(result.cpm).toBe(22.2703);
    expect(result.purchases).toBe(7);
    expect(result.addToCarts).toBe(31);
    expect(result.initiateCheckouts).toBe(15);
    expect(result.landingPageViews).toBe(198);
    expect(result.conversionsJson).toBe(sampleActions);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
    expect(result.rawData).toBe(fullInsight);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('frequency field is present in output (BUG-FB-04 fix — field was added)', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect('frequency' in result).toBe(true);
    expect(result.frequency).toBe(1.3028);
  });

  it('null frequency produces null frequency', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, frequency: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.frequency).toBeNull();
  });

  it('spend is parsed with parseFloat from string', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.spend).toBe(41.20);
    expect(typeof result.spend).toBe('number');
  });

  it('impressions is parsed with parseInt from string', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.impressions).toBe(1850);
    expect(Number.isInteger(result.impressions)).toBe(true);
  });

  it('clicks is parsed with parseInt from string', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.clicks).toBe(58);
    expect(Number.isInteger(result.clicks)).toBe(true);
  });

  it('reach is parsed with parseInt from string', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.reach).toBe(1420);
    expect(Number.isInteger(result.reach)).toBe(true);
  });

  it('null ctr produces null ctr', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, ctr: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.ctr).toBeNull();
  });

  it('null cpc produces null cpc', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, cpc: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.cpc).toBeNull();
  });

  it('null cpm produces null cpm', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, cpm: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.cpm).toBeNull();
  });

  it('action extraction works correctly for all action types', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.purchases).toBe(7);
    expect(result.addToCarts).toBe(31);
    expect(result.initiateCheckouts).toBe(15);
    expect(result.landingPageViews).toBe(198);
  });

  it('missing action type returns 0', () => {
    const raw: FacebookAdInsightRaw = {
      ...fullInsight,
      actions: [{ action_type: 'link_click', value: '100' }],
    };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('null actions produces 0 for all action counts', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, actions: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('conversionsJson equals the raw actions array', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.conversionsJson).toBe(sampleActions);
  });

  it('null actions produces null conversionsJson', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, actions: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.conversionsJson).toBeNull();
  });

  it('conversionValuesJson equals the raw action_values array', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
  });

  it('null action_values produces null conversionValuesJson', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, action_values: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.conversionValuesJson).toBeNull();
  });

  it('missing date_start throws an error', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, date_start: null };
    expect(() => transformAdInsight(raw, SYNCED_AT)).toThrow(
      'Facebook ad insight missing required date_start',
    );
  });

  it('null ad_id falls back to empty string', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, ad_id: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.adId).toBe('');
  });

  it('null adset_id produces null adsetId', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, adset_id: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.adsetId).toBeNull();
  });

  it('null campaign_id produces null campaignId', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, campaign_id: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.campaignId).toBeNull();
  });

  it('null campaign_name produces null campaignName', () => {
    const raw: FacebookAdInsightRaw = { ...fullInsight, campaign_name: null };
    const result = transformAdInsight(raw, SYNCED_AT);
    expect(result.campaignName).toBeNull();
  });

  it('reportDate is parsed from date_start string to a Date', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.reportDate).toBeInstanceOf(Date);
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformAdInsight(fullInsight, SYNCED_AT);
    expect(result.rawData).toBe(fullInsight);
  });
});
