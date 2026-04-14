import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoFlow } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type FlowPage = { data: KlaviyoFlow[]; links: { next: string | null } };

async function getPage(url: string, params?: Record<string, string | number>): Promise<AxiosResponse<FlowPage>> {
  return klaviyoClient.get<FlowPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  return parsed.pathname + parsed.search;
}

export async function fetchFlows(lastSyncedAt: Date | null): Promise<KlaviyoFlow[]> {
  const results: KlaviyoFlow[] = [];

  const params: Record<string, string | number> = {
    'page[size]': 50,
    ...(lastSyncedAt && { filter: `greater-than(updated,${lastSyncedAt.toISOString()})` }),
  };

  let nextUrl: string | null = null;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/flows', nextUrl ? undefined : params);
    results.push(...response.data.data);
    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'flows', count: results.length },
    'fetched',
  );

  return results;
}
