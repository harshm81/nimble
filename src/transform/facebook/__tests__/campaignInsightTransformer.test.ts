import { transformCampaignInsight } from '../campaignInsightTransformer';
import { FacebookCampaignInsightRaw, FacebookAction } from '../../../types/facebook.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const sampleActions: FacebookAction[] = [
  { action_type: 'purchase',            value: '42' },
  { action_type: 'add_to_cart',         value: '185' },
  { action_type: 'initiate_checkout',   value: '97' },
  { action_type: 'landing_page_view',   value: '1204' },
  { action_type: 'link_click',          value: '1350' },
];

const sampleActionValues: FacebookAction[] = [
  { action_type: 'purchase',  value: '3148.50' },
  { action_type: 'add_to_cart', value: '8920.00' },
];

const fullInsight: FacebookCampaignInsightRaw = {
  campaign_id:   '6042147342661',
  campaign_name: 'Summer Sale 2026',
  date_start:    '2026-04-14',
  spend:         '234.56',
  impressions:   '9708',
  clicks:        '312',
  reach:         '7500',
  frequency:     '1.2944',
  ctr:           '3.2139',
  cpc:           '0.7518',
  cpm:           '24.1577',
  actions:       sampleActions,
  action_values: sampleActionValues,
};

describe('transformCampaignInsight', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);

    expect(result.campaignId).toBe('6042147342661');
    expect(result.campaignName).toBe('Summer Sale 2026');
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
    expect(result.spend).toBe(234.56);
    expect(result.impressions).toBe(9708);
    expect(result.clicks).toBe(312);
    expect(result.reach).toBe(7500);
    expect(result.frequency).toBe(1.2944);
    expect(result.ctr).toBe(3.2139);
    expect(result.cpc).toBe(0.7518);
    expect(result.cpm).toBe(24.1577);
    expect(result.purchases).toBe(42);
    expect(result.addToCarts).toBe(185);
    expect(result.initiateCheckouts).toBe(97);
    expect(result.landingPageViews).toBe(1204);
    expect(result.conversionsJson).toBe(sampleActions);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
    expect(result.rawData).toBe(fullInsight);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('spend is parsed with parseFloat from string', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.spend).toBe(234.56);
    expect(typeof result.spend).toBe('number');
  });

  it('impressions is parsed with parseInt from string', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.impressions).toBe(9708);
    expect(Number.isInteger(result.impressions)).toBe(true);
  });

  it('clicks is parsed with parseInt from string', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.clicks).toBe(312);
    expect(Number.isInteger(result.clicks)).toBe(true);
  });

  it('reach is parsed with parseInt from string', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.reach).toBe(7500);
    expect(Number.isInteger(result.reach)).toBe(true);
  });

  it('frequency is parsed with parseFloat when present', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.frequency).toBe(1.2944);
  });

  it('ctr is parsed with parseFloat when present', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.ctr).toBe(3.2139);
  });

  it('cpc is parsed with parseFloat when present', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.cpc).toBe(0.7518);
  });

  it('cpm is parsed with parseFloat when present', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.cpm).toBe(24.1577);
  });

  it('null frequency produces null frequency', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, frequency: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.frequency).toBeNull();
  });

  it('null ctr produces null ctr', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, ctr: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.ctr).toBeNull();
  });

  it('null cpc produces null cpc', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, cpc: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.cpc).toBeNull();
  });

  it('null cpm produces null cpm', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, cpm: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.cpm).toBeNull();
  });

  it('purchases extracted from actions where action_type is purchase', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.purchases).toBe(42);
  });

  it('addToCarts extracted from actions where action_type is add_to_cart', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.addToCarts).toBe(185);
  });

  it('initiateCheckouts extracted from actions where action_type is initiate_checkout', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.initiateCheckouts).toBe(97);
  });

  it('landingPageViews extracted from actions where action_type is landing_page_view', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.landingPageViews).toBe(1204);
  });

  it('missing action type returns 0', () => {
    const raw: FacebookCampaignInsightRaw = {
      ...fullInsight,
      actions: [{ action_type: 'link_click', value: '500' }],
    };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('null actions produces 0 for all action counts', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, actions: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.purchases).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.initiateCheckouts).toBe(0);
    expect(result.landingPageViews).toBe(0);
  });

  it('conversionsJson equals the raw actions array', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.conversionsJson).toBe(sampleActions);
  });

  it('null actions produces null conversionsJson', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, actions: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.conversionsJson).toBeNull();
  });

  it('conversionValuesJson equals the raw action_values array', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.conversionValuesJson).toBe(sampleActionValues);
  });

  it('null action_values produces null conversionValuesJson', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, action_values: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.conversionValuesJson).toBeNull();
  });

  it('missing date_start throws an error', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, date_start: null };
    expect(() => transformCampaignInsight(raw, SYNCED_AT)).toThrow(
      'Facebook campaign insight missing required date_start',
    );
  });

  it('null campaign_id falls back to empty string', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, campaign_id: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.campaignId).toBe('');
  });

  it('null campaign_name produces null campaignName', () => {
    const raw: FacebookCampaignInsightRaw = { ...fullInsight, campaign_name: null };
    const result = transformCampaignInsight(raw, SYNCED_AT);
    expect(result.campaignName).toBeNull();
  });

  it('reportDate is parsed from date_start string to a Date', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.reportDate).toBeInstanceOf(Date);
    expect(result.reportDate).toEqual(new Date('2026-04-14'));
  });

  it('rawData is the same object reference passed in', () => {
    const result = transformCampaignInsight(fullInsight, SYNCED_AT);
    expect(result.rawData).toBe(fullInsight);
  });
});
