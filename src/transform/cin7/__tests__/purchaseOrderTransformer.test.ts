import { transformPurchaseOrder, transformPurchaseOrderLineItems } from '../purchaseOrderTransformer';
import { Cin7PurchaseOrder, Cin7LineItem } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullLineItem: Cin7LineItem = {
  id: 9001,
  productId: 1001,
  code: 'CT-001-S-BLK',
  name: 'Classic Tee - Small - Black',
  qty: 10,
  unitPrice: 12.5,
  discount: 5.0,
  tax: 11.25,
  total: 118.75,
  comment: 'Rush order',
  lineItemType: 'Product',
  sortOrder: 1,
  option1: 'Small',
  option2: 'Black',
  option3: null,
  styleCode: 'CT-001',
  barcode: '9780000000002',
  unitCost: 10.0,
  taxRule: 'GST on Expenses',
  accountCode: '300',
  weight: 0.25,
  cbm: 0.001,
  height: 5.0,
  width: 30.0,
  depth: 20.0,
};

const fullPurchaseOrder: Cin7PurchaseOrder = {
  id: 2001,
  reference: 'PO-2026-0042',
  supplierId: 42,
  supplierName: 'Global Threads',
  supplierEmail: 'orders@globalthreads.com',
  status: 'Authorised',
  createdDate: '2026-03-01T09:00:00Z',
  modifiedDate: '2026-04-10T10:00:00Z',
  completedDate: '2026-04-12T14:00:00Z',
  requiredDate: '2026-04-15T00:00:00Z',
  branchId: 3,
  taxInclusive: false,
  subTotal: 1000.0,
  tax: 100.0,
  total: 1100.0,
  currencyCode: 'AUD',
  exchangeRate: 1.0,
  note: 'Priority stock',
  internalNote: 'Approved by warehouse manager',
  shippingCompany: 'FastFreight',
  shippingMethod: 'Road',
  shippingCost: 50.0,
  shippingTax: 5.0,
  account: '300',
  billingAddress1: '10 Trade St',
  billingAddress2: null,
  billingCity: 'Sydney',
  billingState: 'NSW',
  billingPostCode: '2000',
  billingCountry: 'Australia',
  deliveryAddress1: '5 Warehouse Rd',
  deliveryAddress2: 'Unit 2',
  deliveryCity: 'Melbourne',
  deliveryState: 'VIC',
  deliveryPostCode: '3000',
  deliveryCountry: 'Australia',
  lineItems: [fullLineItem],
};

describe('transformPurchaseOrder', () => {
  it('maps all header fields correctly from a complete fixture', () => {
    const result = transformPurchaseOrder(fullPurchaseOrder, SYNCED_AT);

    expect(result.cin7Id).toBe(2001);
    expect(result.reference).toBe('PO-2026-0042');
    expect(result.supplierId).toBe(42);
    expect(result.supplierName).toBe('Global Threads');
    expect(result.supplierEmail).toBe('orders@globalthreads.com');
    expect(result.status).toBe('Authorised');
    expect(result.branchId).toBe(3);
    expect(result.taxInclusive).toBe(false);
    expect(result.subTotal).toBe(1000.0);
    expect(result.tax).toBe(100.0);
    expect(result.total).toBe(1100.0);
    expect(result.currencyCode).toBe('AUD');
    expect(result.exchangeRate).toBe(1.0);
    expect(result.note).toBe('Priority stock');
    expect(result.internalNote).toBe('Approved by warehouse manager');
    expect(result.shippingCompany).toBe('FastFreight');
    expect(result.shippingMethod).toBe('Road');
    expect(result.shippingCost).toBe(50.0);
    expect(result.shippingTax).toBe(5.0);
    expect(result.account).toBe('300');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.rawData).toBe(fullPurchaseOrder);
  });

  it('takes srcModifiedAt from modifiedDate — BUG-CIN7-04', () => {
    const result = transformPurchaseOrder(fullPurchaseOrder, SYNCED_AT);

    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T10:00:00Z'));
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-01T09:00:00Z'));
  });

  it('parses requiredDate and completedDate to Date objects', () => {
    const result = transformPurchaseOrder(fullPurchaseOrder, SYNCED_AT);

    expect(result.requiredDate).toEqual(new Date('2026-04-15T00:00:00Z'));
    expect(result.completedDate).toEqual(new Date('2026-04-12T14:00:00Z'));
  });

  it('produces null requiredDate and completedDate when source is null', () => {
    const po: Cin7PurchaseOrder = {
      ...fullPurchaseOrder,
      requiredDate: null,
      completedDate: null,
    };
    const result = transformPurchaseOrder(po, SYNCED_AT);

    expect(result.requiredDate).toBeNull();
    expect(result.completedDate).toBeNull();
  });

  it('produces null srcModifiedAt when modifiedDate is null', () => {
    const po: Cin7PurchaseOrder = { ...fullPurchaseOrder, modifiedDate: null };
    const result = transformPurchaseOrder(po, SYNCED_AT);

    expect(result.srcModifiedAt).toBeNull();
  });

  it('produces null srcCreatedAt when createdDate is null', () => {
    const po: Cin7PurchaseOrder = { ...fullPurchaseOrder, createdDate: null };
    const result = transformPurchaseOrder(po, SYNCED_AT);

    expect(result.srcCreatedAt).toBeNull();
  });
});

describe('transformPurchaseOrderLineItems', () => {
  it('returns empty array when lineItems is null', () => {
    const po: Cin7PurchaseOrder = { ...fullPurchaseOrder, lineItems: null };
    const result = transformPurchaseOrderLineItems(po, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('returns empty array when lineItems is an empty array', () => {
    const po: Cin7PurchaseOrder = { ...fullPurchaseOrder, lineItems: [] };
    const result = transformPurchaseOrderLineItems(po, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('maps all line item fields correctly from a fixture with 1 line item', () => {
    const result = transformPurchaseOrderLineItems(fullPurchaseOrder, SYNCED_AT);

    expect(result).toHaveLength(1);
    const li = result[0];

    expect(li.purchaseOrderId).toBe(2001);
    expect(li.cin7LineItemId).toBe(9001);
    expect(li.productId).toBe(1001);
    expect(li.code).toBe('CT-001-S-BLK');
    expect(li.name).toBe('Classic Tee - Small - Black');
    expect(li.qty).toBe(10);
    expect(li.unitPrice).toBe(12.5);
    expect(li.discount).toBe(5.0);
    expect(li.tax).toBe(11.25);
    expect(li.total).toBe(118.75);
    expect(li.unitCost).toBe(10.0);
    expect(li.lineItemType).toBe('Product');
    expect(li.sortOrder).toBe(1);
    expect(li.option1).toBe('Small');
    expect(li.option2).toBe('Black');
    expect(li.option3).toBeNull();
    expect(li.styleCode).toBe('CT-001');
    expect(li.barcode).toBe('9780000000002');
    expect(li.taxRule).toBe('GST on Expenses');
    expect(li.accountCode).toBe('300');
    expect(li.comment).toBe('Rush order');
    expect(li.syncedAt).toBe(SYNCED_AT);
  });
});
