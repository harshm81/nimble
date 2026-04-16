import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoFlow } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type FlowPage = { data: KlaviyoFlow[]; links: { next: string | null } };

async function getPage(url: string, params?: Record<string, string>): Promise<AxiosResponse<FlowPage>> {
  return klaviyoClient.get<FlowPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  // Klaviyo links.next returns full paths like /api/flows?...
  // baseURL is already https://a.klaviyo.com/api — strip the leading /api to avoid /api/api/...
  const path = parsed.pathname.replace(/^\/api/, '');
  return path + parsed.search;
}

export async function fetchFlows(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoFlow[]) => Promise<void>,
): Promise<void> {
  // page[size] not supported in revision 2026-04-15 — cursor-only pagination
  const params: Record<string, string> = {
    ...(lastSyncedAt && { filter: `greater-than(updated,${lastSyncedAt.toISOString()})` }),
  };

  let nextUrl: string | null = null;
  let totalCount = 0;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/flows', nextUrl ? undefined : params);

    if (response.data.data.length > 0) {
      await onPage(response.data.data);
      totalCount += response.data.data.length;
    }

    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'flows', count: totalCount },
    'fetched',
  );
}
