import { ShopifyProductNode } from '../../types/shopify.types';
import { ProductInput } from '../../db/repositories/shopifyRepo';

export function transformProduct(raw: ShopifyProductNode, syncedAt: Date): ProductInput {
  return {
    shopifyId: raw.id,
    title: raw.title ?? null,
    status: raw.status ?? null,
    srcCreatedAt: raw.createdAt ? new Date(raw.createdAt) : null,
    srcModifiedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
    rawData: raw,
    syncedAt,
  };
}
