import { config } from '../../config';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoCampaignStatResult } from '../../types/klaviyo.types';
import { chunk } from '../../utils/chunk';
import { sleep } from '../../utils/sleep';
import { klaviyoClient } from './klaviyoClient';

// campaign-values-reports is rate-limited to 2 req/min and 225 req/day.
// 35 seconds between batches keeps us safely under 2/min.
const CAMPAIGN_STATS_INTER_BATCH_DELAY_MS = 35_000;

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

  const batches = chunk(campaignIds, 100);
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      // campaign-values-reports is limited to 2 req/min — wait between batches
      await sleep(CAMPAIGN_STATS_INTER_BATCH_DELAY_MS);
    }

    const response = await klaviyoClient.post<{ results: KlaviyoCampaignStatResult[] }>(
      '/campaign-values-reports/',
      {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { start: startDate, end: endDate },
            campaign_ids: batches[i],
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
