import { FacebookAdsetRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchAdsets(
  lastSyncedAt: Date | null,
  onPage: (page: FacebookAdsetRaw[]) => Promise<void>,
): Promise<void> {
  const client = createFacebookClient();
  let after: string | null = null;
  let totalCount = 0;

  const baseParams: Record<string, string> = {
    fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,created_time,updated_time',
    limit:  '100',
  };

  if (lastSyncedAt) {
    baseParams['filtering'] = JSON.stringify([
      {
        field:    'updated_time',
        operator: 'GREATER_THAN',
        value:    String(Math.floor(lastSyncedAt.getTime() / 1000)),
      },
    ]);
  }

  do {
    const params: Record<string, string> = { ...baseParams, ...(after ? { after } : {}) };

    const page: FacebookListResponse<FacebookAdsetRaw> = await facebookGet<FacebookListResponse<FacebookAdsetRaw>>(
      client,
      `/act_${client.adAccountId}/adsets`,
      params,
    );

    if (page.data.length > 0) {
      await onPage(page.data);
      totalCount += page.data.length;
    }

    after = page.paging?.next ? (page.paging.cursors?.after ?? null) : null;

    logger.info(
      { platform: FACEBOOK_PLATFORM, module: 'adsets', fetched: page.data.length },
      'page fetched',
    );
  } while (after);

  logger.info({ platform: FACEBOOK_PLATFORM, module: 'adsets', count: totalCount }, 'fetched');
}
