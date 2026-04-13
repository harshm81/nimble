import { cin7Client } from './cin7Client';
import { Cin7StockItem } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchInventory(): Promise<Cin7StockItem[]> {
  const rows = 250;
  let page = 1;
  const results: Cin7StockItem[] = [];

  while (true) {
    const { data } = await cin7Client.get<Cin7StockItem[]>('/v1/Stock', {
      params: { page, rows },
    });

    logger.info({
      platform: CIN7_PLATFORM,
      module: 'inventory',
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
