import { transformStockAdjustment, transformStockAdjustmentLineItems } from '../stockAdjustmentTransformer';
import { Cin7StockAdjustment, Cin7LineItem } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullLineItem: Cin7LineItem = {
  id: 7001,
  productId: 1001,
  code: 'CT-001-S-BLK',
  name: 'Classic Tee - Small - Black',
  qty: -5,
  unitPrice: 29.99,
  discount: 0.0,
  tax: 0.0,
  total: -149.95,
  comment: 'Damaged stock write-off',
  lineItemType: 'Product',
  sortOrder: 1,
  option1: 'Small',
  option2: 'Black',
  option3: null,
  styleCode: 'CT-001',
  barcode: '9780000000002',
  unitCost: 12.5,
  taxRule: 'GST on Income',
  accountCode: '500',
  weight: 0.25,
  cbm: 0.001,
  height: 5.0,
  width: 30.0,
  depth: 20.0,
};

const fullStockAdjustment: Cin7StockAdjustment = {
  id: 4001,
  reference: 'SA-2026-0007',
  branchId: 3,
  status: 'Authorised',
  createdDate: '2026-03-20T08:00:00Z',
  modifiedDate: '2026-04-11T16:45:00Z',
  completedDate: '2026-04-11T17:00:00Z',
  note: 'Quarterly stocktake adjustment',
  lineItems: [fullLineItem],
};

describe('transformStockAdjustment', () => {
  it('maps all header fields correctly from a complete fixture', () => {
    const result = transformStockAdjustment(fullStockAdjustment, SYNCED_AT);

    expect(result.cin7Id).toBe(4001);
    expect(result.reference).toBe('SA-2026-0007');
    expect(result.branchId).toBe(3);
    expect(result.status).toBe('Authorised');
    expect(result.note).toBe('Quarterly stocktake adjustment');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.rawData).toBe(fullStockAdjustment);
  });

  it('takes srcModifiedAt from modifiedDate — BUG-CIN7-04', () => {
    const result = transformStockAdjustment(fullStockAdjustment, SYNCED_AT);

    expect(result.srcModifiedAt).toEqual(new Date('2026-04-11T16:45:00Z'));
    expect(result.srcCreatedAt).toEqual(new Date('2026-03-20T08:00:00Z'));
  });

  it('parses completedDate to a Date object', () => {
    const result = transformStockAdjustment(fullStockAdjustment, SYNCED_AT);

    expect(result.completedDate).toEqual(new Date('2026-04-11T17:00:00Z'));
  });

  it('produces null completedDate when source is null', () => {
    const sa: Cin7StockAdjustment = { ...fullStockAdjustment, completedDate: null };
    const result = transformStockAdjustment(sa, SYNCED_AT);

    expect(result.completedDate).toBeNull();
  });

  it('produces null srcModifiedAt when modifiedDate is null', () => {
    const sa: Cin7StockAdjustment = { ...fullStockAdjustment, modifiedDate: null };
    const result = transformStockAdjustment(sa, SYNCED_AT);

    expect(result.srcModifiedAt).toBeNull();
  });

  it('produces null srcCreatedAt when createdDate is null', () => {
    const sa: Cin7StockAdjustment = { ...fullStockAdjustment, createdDate: null };
    const result = transformStockAdjustment(sa, SYNCED_AT);

    expect(result.srcCreatedAt).toBeNull();
  });

  it('produces null for null optional scalar fields', () => {
    const sa: Cin7StockAdjustment = {
      ...fullStockAdjustment,
      reference: null,
      branchId: null,
      status: null,
      note: null,
    };
    const result = transformStockAdjustment(sa, SYNCED_AT);

    expect(result.reference).toBeNull();
    expect(result.branchId).toBeNull();
    expect(result.status).toBeNull();
    expect(result.note).toBeNull();
  });
});

describe('transformStockAdjustmentLineItems', () => {
  it('returns empty array when lineItems is null', () => {
    const sa: Cin7StockAdjustment = { ...fullStockAdjustment, lineItems: null };
    const result = transformStockAdjustmentLineItems(sa, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('returns empty array when lineItems is an empty array', () => {
    const sa: Cin7StockAdjustment = { ...fullStockAdjustment, lineItems: [] };
    const result = transformStockAdjustmentLineItems(sa, SYNCED_AT);

    expect(result).toEqual([]);
  });

  it('maps all line item fields correctly from a fixture with 1 line item', () => {
    const result = transformStockAdjustmentLineItems(fullStockAdjustment, SYNCED_AT);

    expect(result).toHaveLength(1);
    const li = result[0];

    expect(li.stockAdjustmentId).toBe(4001);
    expect(li.cin7LineItemId).toBe(7001);
    expect(li.productId).toBe(1001);
    expect(li.code).toBe('CT-001-S-BLK');
    expect(li.name).toBe('Classic Tee - Small - Black');
    expect(li.qty).toBe(-5);
    expect(li.unitPrice).toBe(29.99);
    expect(li.discount).toBe(0.0);
    expect(li.tax).toBe(0.0);
    expect(li.total).toBe(-149.95);
    expect(li.unitCost).toBe(12.5);
    expect(li.lineItemType).toBe('Product');
    expect(li.sortOrder).toBe(1);
    expect(li.option1).toBe('Small');
    expect(li.option2).toBe('Black');
    expect(li.option3).toBeNull();
    expect(li.styleCode).toBe('CT-001');
    expect(li.barcode).toBe('9780000000002');
    expect(li.taxRule).toBe('GST on Income');
    expect(li.accountCode).toBe('500');
    expect(li.comment).toBe('Damaged stock write-off');
    expect(li.syncedAt).toBe(SYNCED_AT);
  });
});
