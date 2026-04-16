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

// Stats that don't require a conversion metric — always safe to request
const BASE_STATS_FIELDS = [
  'delivered',
  'opens',
  'opens_unique',
  'open_rate',
  'clicks',
  'clicks_unique',
  'click_rate',
  'unsubscribes',
  'bounced',           // revision 2026-04-15: 'bounces' is invalid — correct name is 'bounced'
] as const;

// Stats that require conversion_metric_id — only requested when the metric ID is configured
const CONVERSION_STATS_FIELDS = [
  'conversions',
  'conversion_rate',
  'conversion_value',
  'revenue_per_recipient',
] as const;

export async function fetchCampaignStats(
  campaignIds: string[],
  startDate: string,
  endDate: string,
  onBatch: (results: KlaviyoCampaignStatResult[]) => Promise<void>,
): Promise<void> {
  if (campaignIds.length === 0) {
    return;
  }

  let totalFetched = 0;
  const batches = chunk(campaignIds, 100);

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      // campaign-values-reports is limited to 2 req/min — wait between batches
      await sleep(CAMPAIGN_STATS_INTER_BATCH_DELAY_MS);
    }

    // revision 2026-04-15: campaign_ids field removed — filter by campaign_id using contains-any
    const ids = JSON.stringify(batches[i]);
    const conversionMetricId = config.KLAVIYO_CONVERSION_METRIC_ID;
    const statistics = conversionMetricId
      ? [...BASE_STATS_FIELDS, ...CONVERSION_STATS_FIELDS]
      : [...BASE_STATS_FIELDS];

    // revision 2026-04-15: response shape is data.attributes.results (not top-level results)
    // conversion_metric_id is required (non-nullable) — only include it when configured
    const response = await klaviyoClient.post<{ data: { attributes: { results: KlaviyoCampaignStatResult[] } } }>(
      '/campaign-values-reports/',
      {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { start: startDate, end: endDate },
            filter: `contains-any(campaign_id,${ids})`,
            ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
            statistics,
          },
        },
      },
    );

    const results = response.data.data.attributes.results ?? [];
    totalFetched += results.length;

    // Upsert each batch immediately — don't accumulate all results in memory.
    // ON DUPLICATE KEY UPDATE makes this idempotent: if the job fails at batch N,
    // batches 1..(N-1) are already persisted and the retry re-upserts them safely.
    await onBatch(results);

    logger.debug(
      { platform: KLAVIYO_PLATFORM, module: 'campaignStats', batch: i + 1, total: batches.length, batchCount: results.length },
      'batch upserted',
    );
  }

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'campaignStats', count: totalFetched },
    'fetched',
  );
}
