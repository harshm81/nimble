import { cin7Client } from './cin7Client';
import { Cin7StockAdjustment } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchStockAdjustments(lastSyncedAt: Date | null): Promise<Cin7StockAdjustment[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7StockAdjustment[] = [];

  const where = lastSyncedAt
    ? `createdDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7StockAdjustment[]>('/v1/Adjustments', {
      params: {
        page,
        rows,
        ...(where !== undefined && { where }),
        order: 'createdDate ASC',
      },
    });

    logger.info({
      platform: CIN7_PLATFORM,
      module: 'stockAdjustments',
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
