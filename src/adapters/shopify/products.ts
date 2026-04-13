import { createShopifyClient, executeQueryWithClient } from './shopifyClient';
import { ShopifyProductNode } from '../../types/shopify.types';
import { SHOPIFY_PLATFORM } from '../../constants/shopify';
import { logger } from '../../utils/logger';

const QUERY = `
query GetProducts($cursor: String, $query: String) {
  products(first: 250, after: $cursor, query: $query) {
    nodes {
      id title status createdAt updatedAt
      variants(first: 100) {
        nodes {
          id title sku price compareAtPrice inventoryQuantity position createdAt updatedAt
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

type ProductsResult = {
  products: {
    nodes: ShopifyProductNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function fetchProducts(lastSyncedAt: Date | null): Promise<ShopifyProductNode[]> {
  const client = await createShopifyClient();
  const results: ShopifyProductNode[] = [];
  let cursor: string | null = null;

  const queryFilter = lastSyncedAt
    ? `updated_at:>${lastSyncedAt.toISOString()}`
    : '';

  do {
    const result: { data: ProductsResult; headers: Record<string, string> } =
      await executeQueryWithClient<ProductsResult>(client, QUERY, { cursor, query: queryFilter });

    const nodes = result.data.products.nodes;

    logger.info({ platform: SHOPIFY_PLATFORM, module: 'products', fetched: nodes.length });

    results.push(...nodes);

    cursor = result.data.products.pageInfo.hasNextPage
      ? result.data.products.pageInfo.endCursor
      : null;
  } while (cursor);

  return results;
}
