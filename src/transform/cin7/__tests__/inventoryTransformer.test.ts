import { transformInventory } from '../inventoryTransformer';
import { Cin7StockItem } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullStockItem: Cin7StockItem = {
  id: 5001,
  productId: 1001,
  branchId: 3,
  code: 'CT-001-S-BLK',
  name: 'Classic Tee - Small - Black',
  barcode: '9780000000002',
  option1: 'Small',
  option2: 'Black',
  option3: null,
  styleCode: 'CT-001',
  isActive: true,
  stockOnHand: 150.0,
  available: 120.0,
  committed: 30.0,
  incoming: 50.0,
  weight: 0.25,
  cbm: 0.001,
  height: 5.0,
  width: 30.0,
  depth: 20.0,
  binLocation: 'A-01-03',
  reorderPoint: 20.0,
  reorderQty: 100.0,
  costPrice: 12.5,
  unitPrice: 29.99,
};

describe('transformInventory', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformInventory(fullStockItem, SYNCED_AT);

    expect(result.cin7Id).toBe(5001);
    expect(result.productId).toBe(1001);
    expect(result.branchId).toBe(3);
    expect(result.code).toBe('CT-001-S-BLK');
    expect(result.name).toBe('Classic Tee - Small - Black');
    expect(result.barcode).toBe('9780000000002');
    expect(result.option1).toBe('Small');
    expect(result.option2).toBe('Black');
    expect(result.option3).toBeNull();
    expect(result.styleCode).toBe('CT-001');
    expect(result.isActive).toBe(true);
    expect(result.binLocation).toBe('A-01-03');
    expect(result.reorderPoint).toBe(20.0);
    expect(result.reorderQty).toBe(100.0);
    expect(result.costPrice).toBe(12.5);
    expect(result.unitPrice).toBe(29.99);
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.rawData).toBe(fullStockItem);
  });

  it('maps physical dimensions correctly — BUG-CIN7-03', () => {
    const result = transformInventory(fullStockItem, SYNCED_AT);

    expect(result.weight).toBe(0.25);
    expect(result.cbm).toBe(0.001);
    expect(result.height).toBe(5.0);
    expect(result.width).toBe(30.0);
    expect(result.depth).toBe(20.0);
  });

  it('produces null for null dimensions', () => {
    const item: Cin7StockItem = {
      ...fullStockItem,
      weight: null,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    };
    const result = transformInventory(item, SYNCED_AT);

    expect(result.weight).toBeNull();
    expect(result.cbm).toBeNull();
    expect(result.height).toBeNull();
    expect(result.width).toBeNull();
    expect(result.depth).toBeNull();
  });

  it('maps stock level fields correctly', () => {
    const result = transformInventory(fullStockItem, SYNCED_AT);

    expect(result.available).toBe(120.0);
    expect(result.stockOnHand).toBe(150.0);
    expect(result.committed).toBe(30.0);
    expect(result.incoming).toBe(50.0);
  });

  it('produces null for null stock levels', () => {
    const item: Cin7StockItem = {
      ...fullStockItem,
      available: null,
      stockOnHand: null,
      committed: null,
      incoming: null,
    };
    const result = transformInventory(item, SYNCED_AT);

    expect(result.available).toBeNull();
    expect(result.stockOnHand).toBeNull();
    expect(result.committed).toBeNull();
    expect(result.incoming).toBeNull();
  });

  it('produces null for null optional scalar fields', () => {
    const item: Cin7StockItem = {
      ...fullStockItem,
      productId: null,
      branchId: null,
      code: null,
      name: null,
      barcode: null,
      option1: null,
      option2: null,
      styleCode: null,
      isActive: null,
      binLocation: null,
      reorderPoint: null,
      reorderQty: null,
      costPrice: null,
      unitPrice: null,
    };
    const result = transformInventory(item, SYNCED_AT);

    expect(result.productId).toBeNull();
    expect(result.branchId).toBeNull();
    expect(result.code).toBeNull();
    expect(result.name).toBeNull();
    expect(result.barcode).toBeNull();
    expect(result.option1).toBeNull();
    expect(result.option2).toBeNull();
    expect(result.styleCode).toBeNull();
    expect(result.isActive).toBeNull();
    expect(result.binLocation).toBeNull();
    expect(result.reorderPoint).toBeNull();
    expect(result.reorderQty).toBeNull();
    expect(result.costPrice).toBeNull();
    expect(result.unitPrice).toBeNull();
  });
});
