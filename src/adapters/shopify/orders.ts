import { createShopifyClient, executeQueryWithClient } from './shopifyClient';
import { ShopifyOrderNode } from '../../types/shopify.types';
import { SHOPIFY_PLATFORM } from '../../constants/shopify';
import { logger } from '../../utils/logger';

const ORDER_QUERY = `
query GetOrders($cursor: String, $query: String) {
  orders(first: 250, after: $cursor, query: $query) {
    nodes {
      id name email
      displayFinancialStatus displayFulfillmentStatus
      totalPriceSet { shopMoney { amount } }
      subtotalPriceSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      currencyCode createdAt processedAt updatedAt
      lineItems(first: 250) {
        nodes {
          id name sku quantity
          originalUnitPriceSet { shopMoney { amount } }
          discountedUnitPriceSet { shopMoney { amount } }
          totalDiscountSet { shopMoney { amount } }
        }
      }
      refunds {
        id createdAt note
        totalRefundedSet { shopMoney { amount } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

type OrdersResult = {
  orders: {
    nodes: ShopifyOrderNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function fetchOrders(lastSyncedAt: Date | null): Promise<ShopifyOrderNode[]> {
  const client = await createShopifyClient();
  const results: ShopifyOrderNode[] = [];
  let cursor: string | null = null;

  const queryFilter = lastSyncedAt
    ? `updated_at:>${lastSyncedAt.toISOString()} status:any`
    : `status:any`;

  do {
    const result: { data: OrdersResult; headers: Record<string, string> } =
      await executeQueryWithClient<OrdersResult>(client, ORDER_QUERY, { cursor, query: queryFilter });

    const { nodes, pageInfo } = result.data.orders;

    logger.info({ platform: SHOPIFY_PLATFORM, module: 'orders', fetched: nodes.length });

    results.push(...nodes);

    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  return results;
}
