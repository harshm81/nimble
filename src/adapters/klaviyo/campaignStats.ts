import { config } from '../../config';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoCampaignStatResult } from '../../types/klaviyo.types';
import { chunk } from '../../utils/chunk';
import { klaviyoClient } from './klaviyoClient';

const STATS_FIELDS = [
  'delivered',
  'opens',
  'opens_unique',
  'open_rate',
  'clicks',
  'clicks_unique',
  'click_rate',
  'unsubscribes',
  'bounces',
  'conversions',
  'conversion_rate',
  'conversion_value',
  'revenue_per_recipient',
] as const;

export async function fetchCampaignStats(
  campaignIds: string[],
  startDate: string,
  endDate: string,
): Promise<KlaviyoCampaignStatResult[]> {
  if (campaignIds.length === 0) {
    return [];
  }

  const allResults: KlaviyoCampaignStatResult[] = [];

  for (const batch of chunk(campaignIds, 100)) {
    const response = await klaviyoClient.post<{ results: KlaviyoCampaignStatResult[] }>(
      '/campaign-values-reports/',
      {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { start: startDate, end: endDate },
            campaign_ids: batch,
            conversion_metric_id: config.KLAVIYO_CONVERSION_METRIC_ID ?? null,
            statistics: STATS_FIELDS,
          },
        },
      },
    );

    allResults.push(...(response.data.results ?? []));
  }

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'campaignStats', count: allResults.length },
    'fetched',
  );

  return allResults;
}
