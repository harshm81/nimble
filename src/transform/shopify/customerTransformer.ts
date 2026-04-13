import { ShopifyCustomerNode } from '../../types/shopify.types';
import { CustomerInput } from '../../db/repositories/shopifyRepo';

export function transformCustomer(raw: ShopifyCustomerNode, syncedAt: Date): CustomerInput {
  return {
    shopifyId: raw.id,
    email: raw.email ?? null,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    phone: raw.phone ?? null,
    srcCreatedAt: new Date(raw.createdAt),
    srcModifiedAt: new Date(raw.updatedAt),
    rawData: raw,
    syncedAt,
  };
}
