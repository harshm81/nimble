import { transformInventory } from '../inventoryTransformer';
import { ShopifyInventoryLevelNode } from '../../../types/shopify.types';

const SYNCED_AT = new Date('2026-04-15T03:00:00.000Z');

const fullInventory: ShopifyInventoryLevelNode = {
  id: 'gid://shopify/InventoryLevel/9001',
  available: 42,
  updatedAt: '2026-04-14T06:00:00+10:00',
};

describe('transformInventory', () => {
  it('maps all fields correctly from a full inventory level', () => {
    const result = transformInventory(fullInventory, SYNCED_AT);

    expect(result.shopifyId).toBe('gid://shopify/InventoryLevel/9001');
    expect(result.available).toBe(42);
    expect(result.rawData).toBe(fullInventory);
    expect(result.syncedAt).toBe(SYNCED_AT);
  });

  it('parses ISO 8601 updatedAt to a Date object', () => {
    const result = transformInventory(fullInventory, SYNCED_AT);
    expect(result.srcModifiedAt).toBeInstanceOf(Date);
    expect(result.srcModifiedAt?.getUTCFullYear()).toBe(2026);
    expect(result.srcModifiedAt?.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(result.srcModifiedAt?.getUTCDate()).toBe(13); // +10:00 offset brings Apr 14 back to Apr 13 UTC
  });

  it('returns null available when available is null (BUG-SHO-04 fix)', () => {
    // Old code used ?? 0 — null means no warehouse assignment, not zero stock
    const inventory: ShopifyInventoryLevelNode = { ...fullInventory, available: null };
    expect(transformInventory(inventory, SYNCED_AT).available).toBeNull();
  });

  it('returns null srcModifiedAt when updatedAt is null', () => {
    const inventory: ShopifyInventoryLevelNode = { ...fullInventory, updatedAt: null };
    expect(transformInventory(inventory, SYNCED_AT).srcModifiedAt).toBeNull();
  });

  it('handles zero available without treating it as null', () => {
    const inventory: ShopifyInventoryLevelNode = { ...fullInventory, available: 0 };
    expect(transformInventory(inventory, SYNCED_AT).available).toBe(0);
  });
});
