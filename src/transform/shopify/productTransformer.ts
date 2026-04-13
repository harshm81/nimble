import { ShopifyProductNode } from '../../types/shopify.types';
import { ProductInput } from '../../db/repositories/shopifyRepo';

export function transformProduct(raw: ShopifyProductNode, syncedAt: Date): ProductInput {
  return {
    shopifyId: raw.id,
    title: raw.title,
    status: raw.status,
    srcCreatedAt: new Date(raw.createdAt),
    srcModifiedAt: new Date(raw.updatedAt),
    rawData: raw,
    syncedAt,
  };
}
