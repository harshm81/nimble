import { transformOrder, transformOrderLineItems } from '../orderTransformer';
import { Cin7SalesOrder, Cin7LineItem } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullLineItem: Cin7LineItem = {
  id:           1001,
  productId:    5501,
  code:         'SHOE-BLK-42',
  name:         'Running Shoe Black Size 42',
  qty:          2,
  unitPrice:    89.9500,
  discount:     10.00,
  tax:          16.19,
  total:        178.95,
  comment:      'Gift wrapped',
  lineItemType: 'Product',
  sortOrder:    1,
  option1:      'Black',
  option2:      '42',
  option3:      null,
  styleCode:    'SHOE-BLK',
  barcode:      '9781234567890',
  unitCost:     45.0000,
  taxRule:      'GST',
  accountCode:  '4000',
  weight:       0.8500,
  cbm:          0.0012,
  height:       14.0000,
  width:        30.0000,
  depth:        20.0000,
};

const fullOrder: Cin7SalesOrder = {
  id:                  88001,
  reference:           'SO-2026-001',
  memberId:            2201,
  memberEmail:         'customer@example.com',
  memberName:          'Jane Smith',
  status:              'Authorised',
  createdDate:         '2026-04-10T08:30:00Z',
  modifiedDate:        '2026-04-12T14:45:00Z',
  completedDate:       '2026-04-13T10:00:00Z',
  invoiceDate:         '2026-04-10T00:00:00Z',
  invoiceNumber:       20261001,
  dueDate:             '2026-05-10T00:00:00Z',
  branchId:            3,
  priceTier:           'Retail',
  paymentTerms:        '30 Days',
  taxInclusive:        true,
  subTotal:            178.95,
  tax:                 16.19,
  total:               195.14,
  paid:                195.14,
  balance:             0,
  currencyCode:        'AUD',
  exchangeRate:        1.000000,
  note:                'Please leave at door',
  internalNote:        'VIP customer',
  shippingNotes:       'Fragile',
  shippingCompany:     'Australia Post',
  shippingMethod:      'Express',
  shippingCost:        9.95,
  shippingTax:         0.90,
  shippingTaxRule:     'GST',
  account:             'Debtors',
  sourceChannel:       'Online',
  externalId:          'EXT-12345',
  externalReference:   'SHOPIFY-9988',
  firstName:           'Jane',
  lastName:            'Smith',
  email:               'customer@example.com',
  phone:               '+61 2 9999 0001',
  mobile:              '+61 400 000 001',
  company:             'Smith Pty Ltd',
  billingAddress1:     '10 Billing St',
  billingAddress2:     'Suite 1',
  billingCity:         'Sydney',
  billingState:        'NSW',
  billingPostCode:     '2000',
  billingCountry:      'Australia',
  shippingAddress1:    '10 Shipping Rd',
  shippingAddress2:    null,
  shippingCity:        'Sydney',
  shippingState:       'NSW',
  shippingPostCode:    '2000',
  shippingCountry:     'Australia',
  lineItems:           [fullLineItem],
};

describe('transformOrder', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);

    expect(result.cin7Id).toBe(88001);
    expect(result.orderNumber).toBe('SO-2026-001');
    expect(result.customerEmail).toBe('customer@example.com');
    expect(result.cin7MemberId).toBe(2201);
    expect(result.status).toBe('Authorised');
    expect(result.totalAmount).toBe(195.14);
    expect(result.taxTotal).toBe(16.19);
    expect(result.lineItemTotal).toBe(178.95);
    expect(result.shippingTotal).toBe(9.95);
    expect(result.paymentTerms).toBe('30 Days');
    expect(result.branchId).toBe(3);
    expect(result.currency).toBe('AUD');
    expect(result.srcCreatedAt).toEqual(new Date('2026-04-10T08:30:00Z'));
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-12T14:45:00Z'));
    expect(result.rawData).toBe(fullOrder);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('paymentTerms maps from raw.paymentTerms, not raw.priceTier (BUG-CIN7-01 fix)', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    // priceTier is 'Retail', paymentTerms is '30 Days' — must come from the correct field
    expect(result.paymentTerms).toBe('30 Days');
    expect(result.paymentTerms).not.toBe('Retail');
  });

  it('srcModifiedAt comes from raw.modifiedDate, not raw.updatedDate (BUG-CIN7-04 fix)', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-12T14:45:00Z'));
  });

  it('srcCreatedAt parses raw.createdDate to a Date', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt).toEqual(new Date('2026-04-10T08:30:00Z'));
  });

  it('srcModifiedAt parses raw.modifiedDate to a Date', () => {
    const result = transformOrder(fullOrder, SYNCED_AT);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toEqual(new Date('2026-04-12T14:45:00Z'));
  });

  it('null modifiedDate produces null srcModifiedAt', () => {
    const order: Cin7SalesOrder = { ...fullOrder, modifiedDate: null };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.srcModifiedAt).toBeNull();
  });

  it('null createdDate produces null srcCreatedAt', () => {
    const order: Cin7SalesOrder = { ...fullOrder, createdDate: null };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.srcCreatedAt).toBeNull();
  });

  it('invoiceNumber is a number (BUG-CIN7-07)', () => {
    // invoiceNumber is stored in rawData — verify the raw field is a number type
    expect(typeof fullOrder.invoiceNumber).toBe('number');
    expect(fullOrder.invoiceNumber).toBe(20261001);
  });

  it('null optional fields produce nulls in output', () => {
    const order: Cin7SalesOrder = {
      ...fullOrder,
      reference:    null,
      memberEmail:  null,
      memberId:     null,
      status:       null,
      total:        null,
      tax:          null,
      subTotal:     null,
      shippingCost: null,
      paymentTerms: null,
      branchId:     null,
      currencyCode: null,
    };
    const result = transformOrder(order, SYNCED_AT);
    expect(result.orderNumber).toBeNull();
    expect(result.customerEmail).toBeNull();
    expect(result.cin7MemberId).toBeNull();
    expect(result.status).toBeNull();
    expect(result.totalAmount).toBeNull();
    expect(result.taxTotal).toBeNull();
    expect(result.lineItemTotal).toBeNull();
    expect(result.shippingTotal).toBeNull();
    expect(result.paymentTerms).toBeNull();
    expect(result.branchId).toBeNull();
    expect(result.currency).toBeNull();
  });
});

describe('transformOrderLineItems', () => {
  it('returns empty array when lineItems is null', () => {
    const order: Cin7SalesOrder = { ...fullOrder, lineItems: null };
    const result = transformOrderLineItems(order, SYNCED_AT);
    expect(result).toEqual([]);
  });

  it('returns empty array when lineItems is empty', () => {
    const order: Cin7SalesOrder = { ...fullOrder, lineItems: [] };
    const result = transformOrderLineItems(order, SYNCED_AT);
    expect(result).toEqual([]);
  });

  it('maps all line item fields correctly from a fixture', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);

    expect(result).toHaveLength(1);
    const li = result[0];

    expect(li.cin7LineItemId).toBe(1001);
    expect(li.productId).toBe(5501);
    expect(li.code).toBe('SHOE-BLK-42');
    expect(li.name).toBe('Running Shoe Black Size 42');
    expect(li.qty).toBe(2);
    expect(li.unitPrice).toBe(89.9500);
    expect(li.discount).toBe(10.00);
    expect(li.tax).toBe(16.19);
    expect(li.total).toBe(178.95);
    expect(li.unitCost).toBe(45.0000);
    expect(li.lineItemType).toBe('Product');
    expect(li.sortOrder).toBe(1);
    expect(li.option1).toBe('Black');
    expect(li.option2).toBe('42');
    expect(li.option3).toBeNull();
    expect(li.styleCode).toBe('SHOE-BLK');
    expect(li.barcode).toBe('9781234567890');
    expect(li.taxRule).toBe('GST');
    expect(li.accountCode).toBe('4000');
    expect(li.comment).toBe('Gift wrapped');
    expect(li.syncedAt).toBe(SYNCED_AT);
  });

  it('orderId in each line item equals the parent order cin7Id', () => {
    const result = transformOrderLineItems(fullOrder, SYNCED_AT);
    expect(result[0].orderId).toBe(fullOrder.id);
    expect(result[0].orderId).toBe(88001);
  });

  it('maps multiple line items preserving orderId on each', () => {
    const secondLineItem: Cin7LineItem = {
      ...fullLineItem,
      id:   1002,
      name: 'Second Product',
      code: 'PROD-002',
    };
    const order: Cin7SalesOrder = { ...fullOrder, lineItems: [fullLineItem, secondLineItem] };
    const result = transformOrderLineItems(order, SYNCED_AT);

    expect(result).toHaveLength(2);
    expect(result[0].orderId).toBe(88001);
    expect(result[1].orderId).toBe(88001);
    expect(result[0].cin7LineItemId).toBe(1001);
    expect(result[1].cin7LineItemId).toBe(1002);
  });

  it('null optional line item fields produce nulls in output', () => {
    const sparseLineItem: Cin7LineItem = {
      id:           1003,
      productId:    null,
      code:         null,
      name:         null,
      qty:          null,
      unitPrice:    null,
      discount:     null,
      tax:          null,
      total:        null,
      comment:      null,
      lineItemType: null,
      sortOrder:    null,
      option1:      null,
      option2:      null,
      option3:      null,
      styleCode:    null,
      barcode:      null,
      unitCost:     null,
      taxRule:      null,
      accountCode:  null,
      weight:       null,
      cbm:          null,
      height:       null,
      width:        null,
      depth:        null,
    };
    const order: Cin7SalesOrder = { ...fullOrder, lineItems: [sparseLineItem] };
    const result = transformOrderLineItems(order, SYNCED_AT);
    const li = result[0];

    expect(li.productId).toBeNull();
    expect(li.code).toBeNull();
    expect(li.name).toBeNull();
    expect(li.qty).toBeNull();
    expect(li.unitPrice).toBeNull();
    expect(li.discount).toBeNull();
    expect(li.tax).toBeNull();
    expect(li.total).toBeNull();
    expect(li.unitCost).toBeNull();
    expect(li.lineItemType).toBeNull();
    expect(li.sortOrder).toBeNull();
    expect(li.option1).toBeNull();
    expect(li.option2).toBeNull();
    expect(li.option3).toBeNull();
    expect(li.styleCode).toBeNull();
    expect(li.barcode).toBeNull();
    expect(li.taxRule).toBeNull();
    expect(li.accountCode).toBeNull();
    expect(li.comment).toBeNull();
  });
});
