import { ShopifyInventoryLevelNode } from '../../types/shopify.types';
import { InventoryInput } from '../../db/repositories/shopifyRepo';

export function transformInventory(raw: ShopifyInventoryLevelNode, syncedAt: Date): InventoryInput {
  return {
    shopifyId: raw.id,
    available: raw.available ?? null,
    srcModifiedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    rawData: raw,
    syncedAt,
  };
}
