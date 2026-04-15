import { transformProduct } from '../productTransformer';
import { Cin7Product } from '../../../types/cin7.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullProduct: Cin7Product = {
  id: 1001,
  name: 'Classic Tee',
  code: 'CT-001',
  barcode: '9780000000001',
  category: 'Apparel',
  brand: 'Nimble',
  supplier: 'Global Threads',
  supplierId: 42,
  description: 'A timeless classic tee in soft cotton.',
  shortDescription: 'Classic cotton tee',
  isActive: true,
  type: 'Standard',
  option1Name: 'Size',
  option2Name: 'Colour',
  option3Name: null,
  unitPrice: 29.99,
  unitPriceTier2: 27.5,
  unitPriceTier3: 26.0,
  unitPriceTier4: 25.0,
  unitPriceTier5: 24.5,
  unitPriceTier6: 24.0,
  unitPriceTier7: 23.5,
  unitPriceTier8: 23.0,
  unitPriceTier9: 22.5,
  unitPriceTier10: 22.0,
  costPrice: 12.5,
  taxRule: 'GST on Income',
  accountCode: '200',
  purchaseTaxRule: 'GST on Expenses',
  purchaseAccountCode: '300',
  weight: 0.25,
  cbm: 0.001,
  height: 5.0,
  width: 30.0,
  depth: 20.0,
  createdDate: '2026-01-10T08:00:00Z',
  modifiedDate: '2026-04-10T10:00:00Z',
};

describe('transformProduct', () => {
  it('maps all fields correctly from a complete fixture', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);

    expect(result.cin7Id).toBe(1001);
    expect(result.name).toBe('Classic Tee');
    expect(result.code).toBe('CT-001');
    expect(result.barcode).toBe('9780000000001');
    expect(result.category).toBe('Apparel');
    expect(result.brand).toBe('Nimble');
    expect(result.supplier).toBe('Global Threads');
    expect(result.supplierId).toBe(42);
    expect(result.description).toBe('A timeless classic tee in soft cotton.');
    expect(result.shortDescription).toBe('Classic cotton tee');
    expect(result.isActive).toBe(true);
    expect(result.type).toBe('Standard');
    expect(result.option1Name).toBe('Size');
    expect(result.option2Name).toBe('Colour');
    expect(result.option3Name).toBeNull();
    expect(result.unitPrice).toBe(29.99);
    expect(result.costPrice).toBe(12.5);
    expect(result.taxRule).toBe('GST on Income');
    expect(result.accountCode).toBe('200');
    expect(result.purchaseTaxRule).toBe('GST on Expenses');
    expect(result.purchaseAccountCode).toBe('300');
    expect(result.syncedAt).toBe(SYNCED_AT);
    expect(result.rawData).toBe(fullProduct);
  });

  it('maps all 9 price tiers (unitPriceTier2 through unitPriceTier10) — BUG-CIN7-02', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);

    expect(result.unitPriceTier2).toBe(27.5);
    expect(result.unitPriceTier3).toBe(26.0);
    expect(result.unitPriceTier4).toBe(25.0);
    expect(result.unitPriceTier5).toBe(24.5);
    expect(result.unitPriceTier6).toBe(24.0);
    expect(result.unitPriceTier7).toBe(23.5);
    expect(result.unitPriceTier8).toBe(23.0);
    expect(result.unitPriceTier9).toBe(22.5);
    expect(result.unitPriceTier10).toBe(22.0);
  });

  it('takes srcModifiedAt from modifiedDate not updatedDate — BUG-CIN7-04', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);

    expect(result.srcModifiedAt).toEqual(new Date('2026-04-10T10:00:00Z'));
    expect(result.srcCreatedAt).toEqual(new Date('2026-01-10T08:00:00Z'));
  });

  it('maps physical dimensions correctly', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);

    expect(result.weight).toBe(0.25);
    expect(result.cbm).toBe(0.001);
    expect(result.height).toBe(5.0);
    expect(result.width).toBe(30.0);
    expect(result.depth).toBe(20.0);
  });

  it('produces null for null price tiers — not 0 or undefined', () => {
    const product: Cin7Product = {
      ...fullProduct,
      unitPriceTier2: null,
      unitPriceTier3: null,
      unitPriceTier4: null,
      unitPriceTier5: null,
      unitPriceTier6: null,
      unitPriceTier7: null,
      unitPriceTier8: null,
      unitPriceTier9: null,
      unitPriceTier10: null,
    };
    const result = transformProduct(product, SYNCED_AT);

    expect(result.unitPriceTier2).toBeNull();
    expect(result.unitPriceTier3).toBeNull();
    expect(result.unitPriceTier4).toBeNull();
    expect(result.unitPriceTier5).toBeNull();
    expect(result.unitPriceTier6).toBeNull();
    expect(result.unitPriceTier7).toBeNull();
    expect(result.unitPriceTier8).toBeNull();
    expect(result.unitPriceTier9).toBeNull();
    expect(result.unitPriceTier10).toBeNull();
  });

  it('produces null for null dimensions', () => {
    const product: Cin7Product = {
      ...fullProduct,
      weight: null,
      cbm: null,
      height: null,
      width: null,
      depth: null,
    };
    const result = transformProduct(product, SYNCED_AT);

    expect(result.weight).toBeNull();
    expect(result.cbm).toBeNull();
    expect(result.height).toBeNull();
    expect(result.width).toBeNull();
    expect(result.depth).toBeNull();
  });

  it('produces null srcModifiedAt when modifiedDate is null', () => {
    const product: Cin7Product = { ...fullProduct, modifiedDate: null };
    const result = transformProduct(product, SYNCED_AT);

    expect(result.srcModifiedAt).toBeNull();
  });

  it('produces null srcCreatedAt when createdDate is null', () => {
    const product: Cin7Product = { ...fullProduct, createdDate: null };
    const result = transformProduct(product, SYNCED_AT);

    expect(result.srcCreatedAt).toBeNull();
  });
});
