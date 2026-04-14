import { FacebookCampaignRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchCampaigns(lastSyncedAt: Date | null): Promise<FacebookCampaignRaw[]> {
  const client = createFacebookClient();
  const results: FacebookCampaignRaw[] = [];
  let after: string | null = null;

  const baseParams: Record<string, string> = {
    fields: 'id,name,status,objective,created_time,updated_time',
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

    const page: FacebookListResponse<FacebookCampaignRaw> = await facebookGet<FacebookListResponse<FacebookCampaignRaw>>(
      client,
      `/act_${client.adAccountId}/campaigns`,
      params,
    );

    results.push(...page.data);
    after = page.paging?.cursors?.after ?? null;

    logger.info(
      { platform: FACEBOOK_PLATFORM, module: 'campaigns', fetched: page.data.length, total: results.length },
      'page fetched',
    );
  } while (after);

  return results;
}
