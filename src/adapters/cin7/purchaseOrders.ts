import { cin7Client } from './cin7Client';
import { Cin7PurchaseOrder } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchPurchaseOrders(lastSyncedAt: Date | null): Promise<Cin7PurchaseOrder[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7PurchaseOrder[] = [];

  const where = lastSyncedAt
    ? `modifiedDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7PurchaseOrder[]>('/v1/PurchaseOrders', {
      params: {
        page,
        rows,
        ...(where !== undefined && { where }),
        order: 'modifiedDate ASC',
      },
    });

    logger.info({
      platform: CIN7_PLATFORM,
      module: 'purchaseOrders',
      page,
      fetched: data.length,
    });

    results.push(...data);

    if (data.length < rows) break;

    page++;
    await sleep(350);
  }

  return results;
}
