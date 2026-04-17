import { createShopifyClient, executeQueryWithClient } from './shopifyClient';
import { ShopifyInventoryLevelNode } from '../../types/shopify.types';
import { SHOPIFY_PLATFORM } from '../../constants/shopify';
import { logger } from '../../utils/logger';

const QUERY = `
query GetInventory($cursor: String) {
  inventoryItems(first: 250, after: $cursor) {
    nodes {
      id
      inventoryLevels(first: 1) {  # intentional: syncs primary location only — multi-location support is a pending feature
        nodes {
          id available updatedAt
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

type InventoryResult = {
  inventoryItems: {
    nodes: {
      inventoryLevels: {
        nodes: ShopifyInventoryLevelNode[];
      };
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function fetchInventory(
  onPage: (page: ShopifyInventoryLevelNode[]) => Promise<void>,
): Promise<void> {
  const client = await createShopifyClient();
  let cursor: string | null = null;

  do {
    const result: { data: InventoryResult; headers: Record<string, string> } =
      await executeQueryWithClient<InventoryResult>(client, QUERY, { cursor });

    const levels = result.data.inventoryItems.nodes.flatMap((n) => n.inventoryLevels.nodes);

    logger.info({ platform: SHOPIFY_PLATFORM, module: 'inventory', fetched: levels.length });

    if (levels.length > 0) await onPage(levels);

    cursor = result.data.inventoryItems.pageInfo.hasNextPage
      ? result.data.inventoryItems.pageInfo.endCursor
      : null;
  } while (cursor);
}
