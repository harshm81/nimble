import { cin7Client } from './cin7Client';
import { Cin7CreditNote } from '../../types/cin7.types';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';
import { CIN7_PLATFORM } from '../../constants/cin7';

export async function fetchCreditNotes(
  lastSyncedAt: Date | null,
  onPage: (page: Cin7CreditNote[]) => Promise<void>,
): Promise<void> {
  const rows = 250;
  let page = 1;
  let totalCount = 0;

  const where = lastSyncedAt
    ? `modifiedDate >= '${lastSyncedAt.toISOString()}'`
    : undefined;

  while (true) {
    const { data } = await cin7Client.get<Cin7CreditNote[]>('/v1/CreditNotes', {
      params: {
        page,
        rows,
        ...(where !== undefined && { where }),
        order: 'modifiedDate ASC',
      },
    });

    if (data.length > 0) {
      await onPage(data);
      totalCount += data.length;
    }

    if (data.length < rows) break;

    page++;
    await sleep(350);
  }

  logger.info({ platform: CIN7_PLATFORM, module: 'creditNotes', count: totalCount }, 'fetched');
}
