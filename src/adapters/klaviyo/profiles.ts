import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoProfile } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type ProfilePage = { data: KlaviyoProfile[]; links: { next: string | null } };

async function getPage(url: string, params?: Record<string, string | number>): Promise<AxiosResponse<ProfilePage>> {
  return klaviyoClient.get<ProfilePage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  // Klaviyo links.next returns full paths like /api/profiles?...
  // baseURL is already https://a.klaviyo.com/api — strip the leading /api to avoid /api/api/...
  const path = parsed.pathname.replace(/^\/api/, '');
  return path + parsed.search;
}

export async function fetchProfiles(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoProfile[]) => Promise<void>,
): Promise<void> {
  // page[size] not supported in revision 2026-04-15 — cursor-only pagination
  const params: Record<string, string> = {
    'additional-fields[profile]': 'subscriptions',
    ...(lastSyncedAt && { filter: `greater-than(updated,${lastSyncedAt.toISOString()})` }),
  };

  let nextUrl: string | null = null;
  let totalCount = 0;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/profiles', nextUrl ? undefined : params);
    const page = response.data.data;

    if (page.length > 0) {
      await onPage(page);
      totalCount += page.length;
    }

    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'profiles', count: totalCount },
    'fetched',
  );
}
