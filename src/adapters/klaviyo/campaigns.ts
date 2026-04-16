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

async function getPage(url: string, params?: Record<string, string>): Promise<AxiosResponse<CampaignPage>> {
  return klaviyoClient.get<CampaignPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  // Klaviyo links.next returns full paths like /api/campaigns?...
  // baseURL is already https://a.klaviyo.com/api — strip the leading /api to avoid /api/api/...
  const path = parsed.pathname.replace(/^\/api/, '');
  return path + parsed.search;
}

export async function fetchCampaigns(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoCampaign[]) => Promise<void>,
): Promise<void> {
  // channel lives inside campaign-message.definition — must persist across all pages
  // because Klaviyo only includes a campaign-message resource on the page where it first appears
  const channelByMessageId = new Map<string, string>();

  // GET /campaigns (revision 2026-04-15) does not support page[size] — cursor-only pagination.
  const params: Record<string, string> = {
    filter: lastSyncedAt
      ? `and(equals(messages.channel,'email'),greater-than(updated_at,${lastSyncedAt.toISOString()}))`
      : `equals(messages.channel,'email')`,
    include: 'campaign-messages',
    // revision 2026-04-15: channel moved inside definition — request definition, not channel
    'fields[campaign-message]': 'definition',
  };

  let nextUrl: string | null = null;
  let page = 0;
  let totalCount = 0;

  do {
    const requestUrl = nextUrl ? toRelativePath(nextUrl) : '/campaigns';
    const requestParams = nextUrl ? undefined : params;

    logger.debug(
      { platform: KLAVIYO_PLATFORM, resource: 'campaigns', page, url: requestUrl, params: requestParams },
      'fetching campaigns page',
    );

    const response = await getPage(requestUrl, requestParams);

    logger.debug(
      {
        platform: KLAVIYO_PLATFORM,
        resource: 'campaigns',
        page,
        count: response.data.data.length,
        hasNext: !!response.data.links?.next,
      },
      'campaigns page received',
    );

    page += 1;

    // Accumulate channel lookup from included campaign-message resources — persists across pages
    for (const msg of response.data.included ?? []) {
      const channel = msg.attributes.definition?.channel ?? null;
      if (channel) {
        channelByMessageId.set(msg.id, channel);
      }
    }

    // Stamp channel onto each campaign in this page using the accumulated map
    for (const campaign of response.data.data) {
      const firstMsgId = campaign.relationships?.['campaign-messages']?.data?.[0]?.id ?? null;
      campaign.attributes._channel = firstMsgId
        ? (channelByMessageId.get(firstMsgId) ?? null)
        : null;
    }

    if (response.data.data.length > 0) {
      await onPage(response.data.data);
      totalCount += response.data.data.length;
    }

    nextUrl = response.data.links?.next ?? null;
    // TODO: remove this limit after verifying data inserts correctly — testing only
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'campaigns', count: totalCount },
    'fetched',
  );
}
