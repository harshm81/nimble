import { FacebookCampaignRaw, FacebookListResponse } from '../../types/facebook.types';
import { FACEBOOK_PLATFORM } from '../../constants/facebook';
import { logger } from '../../utils/logger';
import { createFacebookClient, facebookGet } from './facebookClient';

export async function fetchCampaigns(
  lastSyncedAt: Date | null,
  onPage: (page: FacebookCampaignRaw[]) => Promise<void>,
): Promise<void> {
  const client = createFacebookClient();
  let after: string | null = null;
  let totalCount = 0;

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

    if (page.data.length > 0) {
      await onPage(page.data);
      totalCount += page.data.length;
    }

    // paging.next is only present when more pages exist; cursors.after is present on every page including the last
    after = page.paging?.next ? (page.paging.cursors?.after ?? null) : null;

    logger.info(
      { platform: FACEBOOK_PLATFORM, module: 'campaigns', fetched: page.data.length },
      'page fetched',
    );
  } while (after);

  logger.info({ platform: FACEBOOK_PLATFORM, module: 'campaigns', count: totalCount }, 'fetched');
}
