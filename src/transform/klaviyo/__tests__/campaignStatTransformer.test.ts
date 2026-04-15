import { Prisma } from '@prisma/client';
import { transformCampaignStat } from '../campaignStatTransformer';
import { KlaviyoCampaignStatResult } from '../../../types/klaviyo.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullStat: KlaviyoCampaignStatResult = {
  campaign_id:           'CAMPAIGN-001',
  delivered:             5000,
  opens:                 1800,
  unique_opens:          1500,    // BUG-KLV-03: field is unique_opens, not opens_unique
  open_rate:             0.3,
  clicks:                620,
  unique_clicks:         540,     // BUG-KLV-04: field is unique_clicks, not clicks_unique
  click_rate:            0.108,
  unsubscribes:          12,
  bounced:               38,      // BUG-KLV-05: field is bounced, not bounces
  conversions:           87,
  conversion_rate:       0.0174,
  conversion_value:      4321.50,
  revenue_per_recipient: 0.8643,
};

describe('transformCampaignStat', () => {
  it('maps all fields correctly from a full stat result', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);

    expect(result.klaviyoId).toBe('CAMPAIGN-001');
    expect(result.delivered).toBe(5000);
    expect(result.opens).toBe(1800);
    expect(result.opensUnique).toBe(1500);
    expect(result.clicks).toBe(620);
    expect(result.clicksUnique).toBe(540);
    expect(result.unsubscribes).toBe(12);
    expect(result.bounces).toBe(38);
    expect(result.conversions).toBe(87);
    expect(result.rawData).toBe(fullStat);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('wraps openRate as Prisma.Decimal (BUG-KLV-08 fix)', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);
    expect(result.openRate).toBeInstanceOf(Prisma.Decimal);
    expect(result.openRate?.toString()).toBe('0.3');
  });

  it('wraps clickRate as Prisma.Decimal (BUG-KLV-08 fix)', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);
    expect(result.clickRate).toBeInstanceOf(Prisma.Decimal);
    expect(result.clickRate?.toString()).toBe('0.108');
  });

  it('wraps conversionRate as Prisma.Decimal (BUG-KLV-08 fix)', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);
    expect(result.conversionRate).toBeInstanceOf(Prisma.Decimal);
    expect(result.conversionRate?.toString()).toBe('0.0174');
  });

  it('wraps conversionValue as Prisma.Decimal (BUG-KLV-08 fix)', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);
    expect(result.conversionValue).toBeInstanceOf(Prisma.Decimal);
    expect(result.conversionValue?.toString()).toBe('4321.5');
  });

  it('wraps revenuePerRecipient as Prisma.Decimal (BUG-KLV-08 fix)', () => {
    const result = transformCampaignStat(fullStat, SYNCED_AT);
    expect(result.revenuePerRecipient).toBeInstanceOf(Prisma.Decimal);
    expect(result.revenuePerRecipient?.toString()).toBe('0.8643');
  });

  it('reads opensUnique from unique_opens (BUG-KLV-03 fix)', () => {
    // Verify correct field name mapping: unique_opens → opensUnique
    const stat: KlaviyoCampaignStatResult = { ...fullStat, unique_opens: 999 };
    const result = transformCampaignStat(stat, SYNCED_AT);
    expect(result.opensUnique).toBe(999);
  });

  it('reads clicksUnique from unique_clicks (BUG-KLV-04 fix)', () => {
    // Verify correct field name mapping: unique_clicks → clicksUnique
    const stat: KlaviyoCampaignStatResult = { ...fullStat, unique_clicks: 888 };
    const result = transformCampaignStat(stat, SYNCED_AT);
    expect(result.clicksUnique).toBe(888);
  });

  it('reads bounces from bounced (BUG-KLV-05 fix)', () => {
    // Verify correct field name mapping: bounced → bounces
    const stat: KlaviyoCampaignStatResult = { ...fullStat, bounced: 77 };
    const result = transformCampaignStat(stat, SYNCED_AT);
    expect(result.bounces).toBe(77);
  });

  it('returns null Decimal fields when API returns null', () => {
    const stat: KlaviyoCampaignStatResult = {
      ...fullStat,
      open_rate: null,
      click_rate: null,
      conversion_rate: null,
      conversion_value: null,
      revenue_per_recipient: null,
    };
    const result = transformCampaignStat(stat, SYNCED_AT);
    expect(result.openRate).toBeNull();
    expect(result.clickRate).toBeNull();
    expect(result.conversionRate).toBeNull();
    expect(result.conversionValue).toBeNull();
    expect(result.revenuePerRecipient).toBeNull();
  });

  it('returns null integer fields when API returns null', () => {
    const stat: KlaviyoCampaignStatResult = {
      ...fullStat,
      delivered: null,
      opens: null,
      unique_opens: null,
      clicks: null,
      unique_clicks: null,
      unsubscribes: null,
      bounced: null,
      conversions: null,
    };
    const result = transformCampaignStat(stat, SYNCED_AT);
    expect(result.delivered).toBeNull();
    expect(result.opens).toBeNull();
    expect(result.opensUnique).toBeNull();
    expect(result.clicks).toBeNull();
    expect(result.clicksUnique).toBeNull();
    expect(result.unsubscribes).toBeNull();
    expect(result.bounces).toBeNull();
    expect(result.conversions).toBeNull();
  });

  it('throws when campaign_id is null', () => {
    const stat: KlaviyoCampaignStatResult = { ...fullStat, campaign_id: null };
    expect(() => transformCampaignStat(stat, SYNCED_AT)).toThrow(
      'transformCampaignStat: missing campaign_id in API response',
    );
  });
});
