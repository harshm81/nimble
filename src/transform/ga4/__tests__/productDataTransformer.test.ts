import { Prisma } from '@prisma/client';
import { transformProductData } from '../productDataTransformer';
import { GA4ProductDataRow } from '../../../types/ga4.types';

// Exact shape of a GA4 RunReport row after parseRows() processes it.
// GA4 API returns all dimension and metric values as strings.
// Reference: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');
const PROPERTY_ID = 'properties/123456789';

const fullRow: GA4ProductDataRow = {
  date:           '20260414',
  itemId:         'SKU-001',
  itemName:       'Blue Widget',
  itemBrand:      'Acme',
  itemCategory:   'Widgets',
  itemListViews:  '540',
  itemListClicks: '102',
  itemViews:      '88',
  addToCarts:     '45',
  purchases:      '12',      // mapped from GA4 metric 'itemPurchases' (BUG-GA4-01 was wrong name)
  revenue:        '1440.00', // GA4 returns currency as string — must use Prisma.Decimal
};

describe('transformProductData', () => {
  it('maps all fields correctly from a full row', () => {
    const result = transformProductData(fullRow, PROPERTY_ID, SYNCED_AT);

    expect(result.propertyId).toBe(PROPERTY_ID);
    expect(result.reportDate).toEqual(new Date('2026-04-14T00:00:00.000Z'));
    expect(result.itemId).toBe('SKU-001');
    expect(result.itemName).toBe('Blue Widget');
    expect(result.itemBrand).toBe('Acme');
    expect(result.itemCategory).toBe('Widgets');
    expect(result.itemListViews).toBe(540);
    expect(result.itemListClicks).toBe(102);
    expect(result.itemViews).toBe(88);
    expect(result.addToCarts).toBe(45);
    expect(result.purchases).toBe(12);
    expect(result.revenue).toBeInstanceOf(Prisma.Decimal);
    // Prisma.Decimal normalises trailing zeros: '1440.00' → '1440'
    expect(result.revenue.toFixed(2)).toBe('1440.00');
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('falls back to (not set) sentinel when itemId is null — prevents NULL breaking unique index', () => {
    const row: GA4ProductDataRow = { ...fullRow, itemId: null };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).itemId).toBe('(not set)');
  });

  it('falls back to (not set) sentinel when itemName is null — prevents NULL breaking unique index', () => {
    const row: GA4ProductDataRow = { ...fullRow, itemName: null };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).itemName).toBe('(not set)');
  });

  it('keeps itemBrand as null when not present', () => {
    const row: GA4ProductDataRow = { ...fullRow, itemBrand: null };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).itemBrand).toBeNull();
  });

  it('keeps itemCategory as null when not present', () => {
    const row: GA4ProductDataRow = { ...fullRow, itemCategory: null };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).itemCategory).toBeNull();
  });

  it('defaults all integer metrics to 0 when null', () => {
    const row: GA4ProductDataRow = {
      ...fullRow,
      itemListViews: null,
      itemListClicks: null,
      itemViews: null,
      addToCarts: null,
      purchases: null,
    };
    const result = transformProductData(row, PROPERTY_ID, SYNCED_AT);
    expect(result.itemListViews).toBe(0);
    expect(result.itemListClicks).toBe(0);
    expect(result.itemViews).toBe(0);
    expect(result.addToCarts).toBe(0);
    expect(result.purchases).toBe(0);
  });

  it('defaults revenue to Decimal("0") when null', () => {
    const row: GA4ProductDataRow = { ...fullRow, revenue: null };
    const result = transformProductData(row, PROPERTY_ID, SYNCED_AT);
    expect(result.revenue).toBeInstanceOf(Prisma.Decimal);
    expect(result.revenue.toFixed(2)).toBe('0.00');
  });

  it('preserves full decimal precision on revenue', () => {
    const row: GA4ProductDataRow = { ...fullRow, revenue: '99999.99' };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).revenue.toFixed(2)).toBe('99999.99');
  });

  it('parses GA4 YYYYMMDD date format correctly as UTC midnight', () => {
    const row: GA4ProductDataRow = { ...fullRow, date: '20260101' };
    expect(transformProductData(row, PROPERTY_ID, SYNCED_AT).reportDate)
      .toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('throws when date field is missing', () => {
    const row: GA4ProductDataRow = { ...fullRow, date: '' };
    expect(() => transformProductData(row, PROPERTY_ID, SYNCED_AT))
      .toThrow('GA4 row missing required date field');
  });

  it('stores the raw row as rawData', () => {
    const result = transformProductData(fullRow, PROPERTY_ID, SYNCED_AT);
    expect(result.rawData).toBe(fullRow);
  });
});
