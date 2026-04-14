import { FacebookAdRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchAds(lastSyncedAt: Date | null): Promise<FacebookAdRaw[]> {
  const client = createFacebookClient();
  const results: FacebookAdRaw[] = [];
  let after: string | null = null;

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

    results.push(...page.data);
    after = page.paging?.cursors?.after ?? null;

    logger.info(
      { platform: FACEBOOK_PLATFORM, module: 'ads', fetched: page.data.length, total: results.length },
      'page fetched',
    );
  } while (after);

  return results;
}
