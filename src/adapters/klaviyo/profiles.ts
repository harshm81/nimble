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
  return parsed.pathname + parsed.search;
}

export async function fetchProfiles(lastSyncedAt: Date | null): Promise<KlaviyoProfile[]> {
  const results: KlaviyoProfile[] = [];

  const params: Record<string, string | number> = {
    'page[size]': 100,
    ...(lastSyncedAt && { filter: `greater-than(updated,${lastSyncedAt.toISOString()})` }),
  };

  let nextUrl: string | null = null;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/profiles', nextUrl ? undefined : params);
    results.push(...response.data.data);
    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'profiles', count: results.length },
    'fetched',
  );

  return results;
}
