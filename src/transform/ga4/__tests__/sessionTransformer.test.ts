import { Prisma } from '@prisma/client';
import { transformSession } from '../sessionTransformer';
import { GA4SessionRow } from '../../../types/ga4.types';

// Exact shape of a GA4 RunReport row after parseRows() processes it.
// GA4 API returns all dimension and metric values as strings.
// Reference: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullRow: GA4SessionRow = {
  date:              '20260414',
  source:            'google',
  medium:            'organic',
  campaign:          '(not set)',
  deviceCategory:    'desktop',
  newVsReturning:    'new',
  sessions:          '142',
  totalUsers:        '130',
  newUsers:          '80',
  pageViews:         '420',
  engagementSeconds: '1823.457',  // float — GA4 returns fractional seconds
};

describe('transformSession', () => {
  const PROPERTY_ID = 'properties/123456789';

  it('maps all fields correctly from a full row', () => {
    const result = transformSession(fullRow, PROPERTY_ID, SYNCED_AT);

    expect(result.propertyId).toBe(PROPERTY_ID);
    expect(result.reportDate).toEqual(new Date('2026-04-14T00:00:00.000Z'));
    expect(result.source).toBe('google');
    expect(result.medium).toBe('organic');
    expect(result.campaign).toBe('(not set)');
    expect(result.deviceCategory).toBe('desktop');
    expect(result.newVsReturning).toBe('new');
    expect(result.sessions).toBe(142);
    expect(result.totalUsers).toBe(130);
    expect(result.newUsers).toBe(80);
    expect(result.pageViews).toBe(420);
    // engagementSeconds must be Math.round of float, not parseInt
    expect(result.engagementSeconds).toBe(1823);  // Math.round(1823.457)
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('falls back to (not set) when source is null', () => {
    const row: GA4SessionRow = { ...fullRow, source: null };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.source).toBe('(not set)');
  });

  it('falls back to (not set) when medium is null', () => {
    const row: GA4SessionRow = { ...fullRow, medium: null };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.medium).toBe('(not set)');
  });

  it('falls back to (not set) when campaign is null', () => {
    const row: GA4SessionRow = { ...fullRow, campaign: null };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.campaign).toBe('(not set)');
  });

  it('falls back to (not set) when deviceCategory is null', () => {
    const row: GA4SessionRow = { ...fullRow, deviceCategory: null };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.deviceCategory).toBe('(not set)');
  });

  it('keeps newVsReturning as null when not present', () => {
    const row: GA4SessionRow = { ...fullRow, newVsReturning: null };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.newVsReturning).toBeNull();
  });

  it('defaults all numeric metrics to 0 when null', () => {
    const row: GA4SessionRow = {
      ...fullRow,
      sessions: null,
      totalUsers: null,
      newUsers: null,
      pageViews: null,
      engagementSeconds: null,
    };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.sessions).toBe(0);
    expect(result.totalUsers).toBe(0);
    expect(result.newUsers).toBe(0);
    expect(result.pageViews).toBe(0);
    expect(result.engagementSeconds).toBe(0);
  });

  it('rounds fractional engagement seconds up correctly', () => {
    const row: GA4SessionRow = { ...fullRow, engagementSeconds: '99.5' };
    expect(transformSession(row, PROPERTY_ID, SYNCED_AT).engagementSeconds).toBe(100);
  });

  it('rounds fractional engagement seconds down correctly', () => {
    const row: GA4SessionRow = { ...fullRow, engagementSeconds: '99.4' };
    expect(transformSession(row, PROPERTY_ID, SYNCED_AT).engagementSeconds).toBe(99);
  });

  it('parses the GA4 YYYYMMDD date format correctly as UTC midnight', () => {
    const row: GA4SessionRow = { ...fullRow, date: '20260101' };
    const result = transformSession(row, PROPERTY_ID, SYNCED_AT);
    expect(result.reportDate).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('throws when date field is missing', () => {
    const row: GA4SessionRow = { ...fullRow, date: '' };
    expect(() => transformSession(row, PROPERTY_ID, SYNCED_AT)).toThrow('GA4 row missing required date field');
  });
});
