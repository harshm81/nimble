import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoCampaign, KlaviyoCampaignMessageAttributes } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type IncludedCampaignMessage = {
  id: string;
  type: string;
  attributes: KlaviyoCampaignMessageAttributes;
};

type CampaignPage = {
  data: KlaviyoCampaign[];
  included: IncludedCampaignMessage[] | null;
  links: { next: string | null };
};

async function getPage(url: string, params?: Record<string, string | number>): Promise<AxiosResponse<CampaignPage>> {
  return klaviyoClient.get<CampaignPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  return parsed.pathname + parsed.search;
}

export async function fetchCampaigns(lastSyncedAt: Date | null): Promise<KlaviyoCampaign[]> {
  const results: KlaviyoCampaign[] = [];
  // channel lives on campaign-message, not campaign — build lookup across pages
  const channelByMessageId = new Map<string, string>();

  const params: Record<string, string | number> = {
    'page[size]': 50,
    // filter on messages.channel per API docs (not top-level channel)
    filter: lastSyncedAt
      ? `and(equals(messages.channel,'email'),greater-than(updated_at,${lastSyncedAt.toISOString()}))`
      : `equals(messages.channel,'email')`,
    include: 'campaign-messages',
    'fields[campaign-message]': 'channel',
  };

  let nextUrl: string | null = null;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/campaigns', nextUrl ? undefined : params);

    // Index channel from included campaign-message resources
    for (const msg of response.data.included ?? []) {
      if (msg.attributes.channel) {
        channelByMessageId.set(msg.id, msg.attributes.channel);
      }
    }

    results.push(...response.data.data);
    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  // Stamp channel onto each campaign using the first campaign-message's channel
  for (const campaign of results) {
    const firstMsgId = campaign.relationships?.['campaign-messages']?.data?.[0]?.id ?? null;
    campaign.attributes._channel = firstMsgId
      ? (channelByMessageId.get(firstMsgId) ?? null)
      : null;
  }

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'campaigns', count: results.length },
    'fetched',
  );

  return results;
}
