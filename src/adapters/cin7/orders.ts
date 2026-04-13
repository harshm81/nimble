import { cin7Client } from './cin7Client';
import { Cin7SalesOrder } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchOrders(lastSyncedAt: Date | null): Promise<Cin7SalesOrder[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7SalesOrder[] = [];

  const where = lastSyncedAt
    ? `modifiedDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7SalesOrder[]>('/v1/SalesOrders', {
      params: {
        page,
        rows,
        ...(where !== undefined && { where }),
        order: 'modifiedDate ASC',
      },
    });

    logger.info({
      platform: CIN7_PLATFORM,
      module: 'orders',
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
