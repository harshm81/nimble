export const SHOPIFY_PLATFORM = 'shopify';
export const SHOPIFY_QUEUE = 'shopify';
export const SHOPIFY_API_VERSION = '2026-04';

export const SHOPIFY_BASE_URL = (shop: string) =>
  `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

export const SHOPIFY_JOBS = {
  ORDERS: 'shopify:orders',
  CUSTOMERS: 'shopify:customers',
  PRODUCTS: 'shopify:products',
  INVENTORY: 'shopify:inventory',
  PRODUCT_VARIANTS: 'shopify:product-variants',
} as const;
