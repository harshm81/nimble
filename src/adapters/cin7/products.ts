import { cin7Client } from './cin7Client';
import { Cin7Product } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchProducts(lastSyncedAt: Date | null): Promise<Cin7Product[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7Product[] = [];

  const where = lastSyncedAt
    ? `modifiedDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7Product[]>('/v1/Products', {
      params: {
        page,
        rows,
        ...(where !== undefined && { where }),
        order: 'modifiedDate ASC',
      },
    });

    logger.info({
      platform: CIN7_PLATFORM,
      module: 'products',
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
