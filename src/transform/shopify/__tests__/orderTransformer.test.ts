import { transformOrder, transformOrderLineItems, transformRefunds } from '../orderTransformer';
import { ShopifyOrderNode } from '../../../types/shopify.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullOrder: ShopifyOrderNode = {
  id: 'gid://shopify/Order/1001',
  name: '#1001',
  email: 'customer@example.com',
  displayFinancialStatus: 'PAID',
  displayFulfillmentStatus: 'FULFILLED',
  totalPriceSet: { shopMoney: { amount: '199.95' } },
  subtotalPriceSet: { shopMoney: { amount: '179.95' } },
  totalTaxSet: { shopMoney: { amount: '20.00' } },
  currencyCode: 'AUD',
  createdAt: '2026-04-10T10:00:00+10:00',
  processedAt: '2026-04-10T10:01:00+10:00',
  updatedAt: '2026-04-11T09:00:00+10:00',
  lineItems: {
    nodes: [
      {
        id: 'gid://shopify/LineItem/2001',
        name: 'Blue Widget',
        sku: 'SKU-BLUE-001',
        quantity: 2,
        originalUnitPriceSet: { shopMoney: { amount: '99.95' } },
        discountedUnitPriceSet: { shopMoney: { amount: '89.98' } },
        totalDiscountSet: { shopMoney: { amount: '9.97' } },
      },
      {
        id: 'gid://shopify/LineItem/2002',
        name: null,
        sku: null,
        quantity: null,
        originalUnitPriceSet: null,
        discountedUnitPriceSet: null,
        totalDiscountSet: null,
      },
    ],
  },
  refunds: [
    {
      id: 'gid://shopify/Refund/3001',
      createdAt: '2026-04-12T08:00:00+10:00',
      note: 'Customer changed mind',
      totalRefundedSet: { shopMoney: { amount: '89.98' } },
    },
    {
      id: 'gid://shopify/Refund/3002',
      createdAt: null,
      note: null,
      totalRefundedSet: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// transformOrder
// ---------------------------------------------------------------------------

describe('transformOrder', () => {
  it('maps all fields correctly from a full order', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);

    expect(result.shopifyId).toBe('gid://shopify/Order/1001');
    expect(result.orderName).toBe('#1001');
    expect(result.customerEmail).toBe('customer@example.com');
    expect(result.financialStatus).toBe('PAID');
    expect(result.fulfillmentStatus).toBe('FULFILLED');
    expect(result.currency).toBe('AUD');
    expect(result.rawData).toBe(fullOrder);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('parses money fields as numbers from shopMoney.amount strings', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    expect(result.totalPrice).toBeCloseTo(199.95, 2);
    expect(result.subtotalPrice).toBeCloseTo(179.95, 2);
    expect(result.totalTax).toBeCloseTo(20.00, 2);
  });

  it('returns null money fields when priceSet is null', () => {
    const order: ShopifyOrderNode = {
      ...fullOrder,
      totalPriceSet: null,
      subtotalPriceSet: null,
      totalTaxSet: null,
    };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.totalPrice).toBeNull();
    expect(result.subtotalPrice).toBeNull();
    expect(result.totalTax).toBeNull();
  });

  it('parses ISO 8601 date strings with timezone to Date objects', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.orderDate).toBeInstanceOf(Date);
  });

  it('returns null dates when source fields are null', () => {
    const order: ShopifyOrderNode = {
      ...fullOrder,
      createdAt: null,
      processedAt: null,
      updatedAt: null,
    };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
    expect(result.orderDate).toBeNull();
  });

  it('returns null for nullable string fields when null', () => {
    const order: ShopifyOrderNode = {
      ...fullOrder,
      name: null,
      email: null,
      displayFinancialStatus: null,
      displayFulfillmentStatus: null,
      currencyCode: null,
    };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.orderName).toBeNull();
    expect(result.customerEmail).toBeNull();
    expect(result.financialStatus).toBeNull();
    expect(result.fulfillmentStatus).toBeNull();
    expect(result.currency).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transformOrderLineItems
// ---------------------------------------------------------------------------

describe('transformOrderLineItems', () => {
  it('returns one input per line item node', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    expect(result).toHaveLength(2);
  });

  it('maps all fields on a full line item', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    const li = result[0];

    expect(li.shopifyOrderId).toBe('gid://shopify/Order/1001');
    expect(li.shopifyLineItemId).toBe('gid://shopify/LineItem/2001');
    expect(li.name).toBe('Blue Widget');
    expect(li.sku).toBe('SKU-BLUE-001');
    expect(li.quantity).toBe(2);
    expect(li.originalUnitPrice).toBeCloseTo(99.95, 2);
    expect(li.discountedUnitPrice).toBeCloseTo(89.98, 2);
    expect(li.totalDiscount).toBeCloseTo(9.97, 2);
    expect(li.syncedAt).toBe(SYNCED_AT);
  });

  it('returns null quantity when line item quantity is null (BUG-SHO-05 fix)', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    // Second line item has quantity: null
    expect(result[1].quantity).toBeNull();
  });

  it('returns null for nullable string and money fields when null', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    const li = result[1];
    expect(li.name).toBeNull();
    expect(li.sku).toBeNull();
    expect(li.originalUnitPrice).toBeNull();
    expect(li.discountedUnitPrice).toBeNull();
    expect(li.totalDiscount).toBeNull();
  });

  it('carries the order updatedAt as srcModifiedAt on each line item', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    expect(result[0].srcModifiedAt).toEqual(new Date('2026-04-11T09:00:00+10:00'));
  });
});

// ---------------------------------------------------------------------------
// transformRefunds
// ---------------------------------------------------------------------------

describe('transformRefunds', () => {
  it('returns one input per refund', () => {
    const result = transformRefunds(fullOrder, SYNCED_AT);
    expect(result).toHaveLength(2);
  });

  it('maps all fields on a full refund', () => {
    const result = transformRefunds(fullOrder, SYNCED_AT);
    const r = result[0];

    expect(r.shopifyOrderId).toBe('gid://shopify/Order/1001');
    expect(r.shopifyRefundId).toBe('gid://shopify/Refund/3001');
    expect(r.note).toBe('Customer changed mind');
    expect(r.totalRefunded).toBeCloseTo(89.98, 2);
    expect(r.syncedAt).toBe(SYNCED_AT);
  });

  it('parses refundedAt as a Date', () => {
    const result = transformRefunds(fullOrder, SYNCED_AT);
    expect(result[0].refundedAt).toBeInstanceOf(Date);
    expect(result[0].refundedAt?.getUTCFullYear()).toBe(2026);
  });

  it('returns null for nullable refund fields when null', () => {
    const result = transformRefunds(fullOrder, SYNCED_AT);
    const r = result[1];
    expect(r.refundedAt).toBeNull();
    expect(r.note).toBeNull();
    expect(r.totalRefunded).toBeNull();
  });
});
