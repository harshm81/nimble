import { cin7Client } from './cin7Client';
import { Cin7StockItem } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchInventory(
  onPage: (page: Cin7StockItem[]) => Promise<void>,
): Promise<void> {
  const rows = 250;
  let page = 1;
  let totalCount = 0;

  while (true) {
    const { data } = await cin7Client.get<Cin7StockItem[]>('/v1/Stock', {
      params: { page, rows },
    });

    if (data.length > 0) {
      await onPage(data);
      totalCount += data.length;
    }

    if (data.length < rows) break;

    page++;
    await sleep(350);
  }

  logger.info({ platform: CIN7_PLATFORM, module: 'inventory', count: totalCount }, 'fetched');
}
