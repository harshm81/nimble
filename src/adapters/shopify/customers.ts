import { createShopifyClient, executeQueryWithClient } from './shopifyClient';
import { ShopifyCustomerNode } from '../../types/shopify.types';
import { SHOPIFY_PLATFORM } from '../../constants/shopify';
import { logger } from '../../utils/logger';

const QUERY = `
query GetCustomers($cursor: String, $query: String) {
  customers(first: 250, after: $cursor, query: $query) {
    nodes {
      id email firstName lastName phone createdAt updatedAt
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

type CustomersResult = {
  customers: {
    nodes: ShopifyCustomerNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function fetchCustomers(
  lastSyncedAt: Date | null,
  onPage: (page: ShopifyCustomerNode[]) => Promise<void>,
): Promise<void> {
  const client = await createShopifyClient();
  let cursor: string | null = null;

  const queryFilter = lastSyncedAt
    ? `updated_at:>${lastSyncedAt.toISOString()}`
    : '';

  do {
    const result: { data: CustomersResult; headers: Record<string, string> } =
      await executeQueryWithClient<CustomersResult>(client, QUERY, { cursor, query: queryFilter });

    const nodes = result.data.customers.nodes;

    logger.info({ platform: SHOPIFY_PLATFORM, module: 'customers', fetched: nodes.length });

    if (nodes.length > 0) await onPage(nodes);

    cursor = result.data.customers.pageInfo.hasNextPage
      ? result.data.customers.pageInfo.endCursor
      : null;
  } while (cursor);
}
