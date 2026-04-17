import { FacebookAdRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchAds(
  lastSyncedAt: Date | null,
  onPage: (page: FacebookAdRaw[]) => Promise<void>,
): Promise<void> {
  const client = createFacebookClient();
  let after: string | null = null;
  let totalCount = 0;

  const baseParams: Record<string, string> = {
    fields: 'id,name,adset_id,campaign_id,status,created_time,updated_time',
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

    const page: FacebookListResponse<FacebookAdRaw> = await facebookGet<FacebookListResponse<FacebookAdRaw>>(
      client,
      `/act_${client.adAccountId}/ads`,
      params,
    );

    if (page.data.length > 0) {
      await onPage(page.data);
      totalCount += page.data.length;
    }

    after = page.paging?.next ? (page.paging.cursors?.after ?? null) : null;

    logger.info(
      { platform: FACEBOOK_PLATFORM, module: 'ads', fetched: page.data.length },
      'page fetched',
    );
  } while (after);

  logger.info({ platform: FACEBOOK_PLATFORM, module: 'ads', count: totalCount }, 'fetched');
}
