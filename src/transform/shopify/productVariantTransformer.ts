import { ShopifyProductNode } from '../../types/shopify.types';
import { ProductVariantInput } from '../../db/repositories/shopifyRepo';

export function transformProductVariants(raw: ShopifyProductNode, syncedAt: Date): ProductVariantInput[] {
  return raw.variants.nodes.map((v): ProductVariantInput => ({
    shopifyProductId: raw.id,
    shopifyVariantId: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price !== null ? parseFloat(v.price) : null,
    compareAtPrice: v.compareAtPrice !== null ? parseFloat(v.compareAtPrice) : null,
    inventoryQuantity: v.inventoryQuantity,
    position: v.position,
    srcCreatedAt: v.createdAt ? new Date(v.createdAt) : null,
    srcModifiedAt: v.updatedAt ? new Date(v.updatedAt) : null,
    rawData: v,
    syncedAt,
  }));
}
