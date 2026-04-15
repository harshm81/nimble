import { Prisma } from '@prisma/client';
import { transformEcommerceEvent } from '../ecommerceEventTransformer';
import { GA4EcommerceEventRow } from '../../../types/ga4.types';

// Exact shape of a GA4 RunReport row after parseRows() processes it.
// GA4 API returns all dimension and metric values as strings.
// Reference: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');
const PROPERTY_ID = 'properties/123456789';

const purchaseRow: GA4EcommerceEventRow = {
  date:         '20260414',
  eventName:    'purchase',
  source:       'google',
  medium:       'cpc',
  transactions: '37',
  revenue:      '4521.50',  // GA4 returns currency as string — must use Prisma.Decimal not parseFloat
  addToCarts:   '0',
  checkouts:    '0',
};

const addToCartRow: GA4EcommerceEventRow = {
  date:         '20260414',
  eventName:    'add_to_cart',
  source:       'direct',
  medium:       '(none)',
  transactions: '0',
  revenue:      '0',
  addToCarts:   '192',
  checkouts:    '0',
};

describe('transformEcommerceEvent', () => {
  it('maps a purchase row correctly', () => {
    const result = transformEcommerceEvent(purchaseRow, PROPERTY_ID, SYNCED_AT);

    expect(result.propertyId).toBe(PROPERTY_ID);
    expect(result.reportDate).toEqual(new Date('2026-04-14T00:00:00.000Z'));
    expect(result.eventName).toBe('purchase');
    expect(result.source).toBe('google');
    expect(result.medium).toBe('cpc');
    expect(result.transactions).toBe(37);
    // Revenue must be a Prisma.Decimal to avoid IEEE 754 float precision loss
    expect(result.revenue).toBeInstanceOf(Prisma.Decimal);
    // Prisma.Decimal normalises trailing zeros: '4521.50' → '4521.5'
    expect(result.revenue.toFixed(2)).toBe('4521.50');
    expect(result.addToCarts).toBe(0);
    expect(result.checkouts).toBe(0);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('maps an add_to_cart row correctly', () => {
    const result = transformEcommerceEvent(addToCartRow, PROPERTY_ID, SYNCED_AT);
    expect(result.eventName).toBe('add_to_cart');
    expect(result.addToCarts).toBe(192);
    expect(result.transactions).toBe(0);
    expect(result.revenue.toFixed(2)).toBe('0.00');
  });

  it('falls back to (not set) when eventName is null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, eventName: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).eventName).toBe('(not set)');
  });

  it('falls back to (not set) when source is null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, source: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).source).toBe('(not set)');
  });

  it('falls back to (not set) when medium is null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, medium: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).medium).toBe('(not set)');
  });

  it('defaults revenue to Decimal("0") when null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, revenue: null };
    const result = transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT);
    expect(result.revenue).toBeInstanceOf(Prisma.Decimal);
    expect(result.revenue.toFixed(2)).toBe('0.00');
  });

  it('defaults transactions to 0 when null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, transactions: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).transactions).toBe(0);
  });

  it('defaults addToCarts to 0 when null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, addToCarts: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).addToCarts).toBe(0);
  });

  it('defaults checkouts to 0 when null', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, checkouts: null };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).checkouts).toBe(0);
  });

  it('preserves full decimal precision on revenue — not truncated by parseFloat', () => {
    // This is BUG-GA4-06: parseFloat("12345678.99") → 12345678.99 is fine,
    // but parseFloat("0.1") + parseFloat("0.2") !== 0.3. Decimal string avoids this.
    const row: GA4EcommerceEventRow = { ...purchaseRow, revenue: '12345678.99' };
    const result = transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT);
    expect(result.revenue.toFixed(2)).toBe('12345678.99');
  });

  it('parses GA4 YYYYMMDD date format correctly as UTC midnight', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, date: '20260101' };
    expect(transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT).reportDate)
      .toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('throws when date field is missing', () => {
    const row: GA4EcommerceEventRow = { ...purchaseRow, date: '' };
    expect(() => transformEcommerceEvent(row, PROPERTY_ID, SYNCED_AT))
      .toThrow('GA4 row missing required date field');
  });

  it('stores the raw row as rawData', () => {
    const result = transformEcommerceEvent(purchaseRow, PROPERTY_ID, SYNCED_AT);
    expect(result.rawData).toBe(purchaseRow);
  });
});
