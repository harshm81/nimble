import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoCampaign } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type CampaignPage = { data: KlaviyoCampaign[]; links: { next: string | null } };

async function getPage(url: string, params?: Record<string, string | number>): Promise<AxiosResponse<CampaignPage>> {
  return klaviyoClient.get<CampaignPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  return parsed.pathname + parsed.search;
}

export async function fetchCampaigns(lastSyncedAt: Date | null): Promise<KlaviyoCampaign[]> {
  const results: KlaviyoCampaign[] = [];

  const params: Record<string, string | number> = {
    'page[size]': 50,
    filter: lastSyncedAt
      ? `and(equals(channel,'email'),greater-than(updated_at,${lastSyncedAt.toISOString()}))`
      : `equals(channel,'email')`,
  };

  let nextUrl: string | null = null;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/campaigns', nextUrl ? undefined : params);
    results.push(...response.data.data);
    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'campaigns', count: results.length },
    'fetched',
  );

  return results;
}
