import { transformProductVariants } from '../productVariantTransformer';
import { ShopifyProductNode } from '../../../types/shopify.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullProduct: ShopifyProductNode = {
  id: 'gid://shopify/Product/7001',
  title: 'Blue Widget',
  status: 'ACTIVE',
  createdAt: '2025-01-15T10:00:00+10:00',
  updatedAt: '2026-04-10T14:00:00+10:00',
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/8001',
        title: 'Small / Blue',
        sku: 'SKU-BLUE-S',
        price: '49.95',
        compareAtPrice: '59.95',
        inventoryQuantity: 100,
        position: 1,
        createdAt: '2025-01-15T10:00:00+10:00',
        updatedAt: '2026-04-10T14:00:00+10:00',
      },
      {
        id: 'gid://shopify/ProductVariant/8002',
        title: null,
        sku: null,
        price: null,
        compareAtPrice: null,
        inventoryQuantity: null,
        position: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
  },
};

describe('transformProductVariants', () => {
  it('returns one input per variant node', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result).toHaveLength(2);
  });

  it('maps all fields correctly from a full variant', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    const v = result[0];

    expect(v.shopifyProductId).toBe('gid://shopify/Product/7001');
    expect(v.shopifyVariantId).toBe('gid://shopify/ProductVariant/8001');
    expect(v.title).toBe('Small / Blue');
    expect(v.sku).toBe('SKU-BLUE-S');
    expect(v.price).toBeCloseTo(49.95, 2);
    expect(v.compareAtPrice).toBeCloseTo(59.95, 2);
    expect(v.inventoryQuantity).toBe(100);
    expect(v.position).toBe(1);
    expect(v.syncedAt).toBe(SYNCED_AT);
  });

  it('parses ISO 8601 date strings to Date objects', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[0].srcCreatedAt).toBeInstanceOf(Date);
    expect(result[0].srcModifiedAt).toBeInstanceOf(Date);
    expect(result[0].srcCreatedAt?.getUTCFullYear()).toBe(2025);
  });

  it('returns null title when title is null (BUG-SHO-07 fix)', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].title).toBeNull();
  });

  it('returns null sku when sku is null (BUG-SHO-07 fix)', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].sku).toBeNull();
  });

  it('returns null price when price is null', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].price).toBeNull();
  });

  it('returns null compareAtPrice when compareAtPrice is null', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].compareAtPrice).toBeNull();
  });

  it('returns null inventoryQuantity when inventoryQuantity is null', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].inventoryQuantity).toBeNull();
  });

  it('returns null position when position is null', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].position).toBeNull();
  });

  it('returns null srcCreatedAt and srcModifiedAt when dates are null', () => {
    const result = transformProductVariants(fullProduct, SYNCED_AT);
    expect(result[1].srcCreatedAt).toBeNull();
    expect(result[1].srcModifiedAt).toBeNull();
  });

  it('returns empty array for a product with no variants', () => {
    const product: ShopifyProductNode = { ...fullProduct, variants: { nodes: [] } };
    expect(transformProductVariants(product, SYNCED_AT)).toHaveLength(0);
  });
});
