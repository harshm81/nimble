import { ShopifyInventoryLevelNode } from '../../types/shopify.types';
import { InventoryInput } from '../../db/repositories/shopifyRepo';

export function transformInventory(raw: ShopifyInventoryLevelNode, syncedAt: Date): InventoryInput {
  return {
    shopifyId: raw.id,
    available: raw.available,
    srcModifiedAt: new Date(raw.updatedAt),
    rawData: raw,
    syncedAt,
  };
}
