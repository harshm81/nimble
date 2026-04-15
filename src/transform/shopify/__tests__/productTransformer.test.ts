import { transformProduct } from '../productTransformer';
import { ShopifyProductNode } from '../../../types/shopify.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullProduct: ShopifyProductNode = {
  id: 'gid://shopify/Product/7001',
  title: 'Blue Widget',
  status: 'ACTIVE',
  createdAt: '2025-01-15T10:00:00+10:00',
  updatedAt: '2026-04-10T14:00:00+10:00',
  variants: { nodes: [] },
};

describe('transformProduct', () => {
  it('maps all fields correctly from a full product', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);

    expect(result.shopifyId).toBe('gid://shopify/Product/7001');
    expect(result.title).toBe('Blue Widget');
    expect(result.status).toBe('ACTIVE');
    expect(result.rawData).toBe(fullProduct);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('parses ISO 8601 date strings with timezone to Date objects', () => {
    const result = transformProduct(fullProduct, SYNCED_AT);
    expect(result.srcCreatedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcCreatedAt?.getUTCFullYear()).toBe(2025);
    expect(result.srcModifiedAt?.getUTCFullYear()).toBe(2026);
  });

  it('returns null title when title is null (BUG-SHO-06 fix)', () => {
    // Old code used ?? '' which hid null as empty string
    const product: ShopifyProductNode = { ...fullProduct, title: null };
    expect(transformProduct(product, SYNCED_AT).title).toBeNull();
  });

  it('returns null status when status is null (BUG-SHO-06 fix)', () => {
    // Old code used ?? '' which hid null as empty string
    const product: ShopifyProductNode = { ...fullProduct, status: null };
    expect(transformProduct(product, SYNCED_AT).status).toBeNull();
  });

  it('returns null srcCreatedAt when createdAt is null', () => {
    const product: ShopifyProductNode = { ...fullProduct, createdAt: null };
    expect(transformProduct(product, SYNCED_AT).srcCreatedAt).toBeNull();
  });

  it('returns null srcModifiedAt when updatedAt is null', () => {
    const product: ShopifyProductNode = { ...fullProduct, updatedAt: null };
    expect(transformProduct(product, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('handles a minimal product with all optional fields null', () => {
    const minimal: ShopifyProductNode = {
      id: 'gid://shopify/Product/9999',
      title: null,
      status: null,
      createdAt: null,
      updatedAt: null,
      variants: { nodes: [] },
    };
    const result = transformProduct(minimal, SYNCED_AT);
    expect(result.shopifyId).toBe('gid://shopify/Product/9999');
    expect(result.title).toBeNull();
    expect(result.status).toBeNull();
    expect(result.srcCreatedAt).toBeNull();
    expect(result.srcModifiedAt).toBeNull();
  });
});
