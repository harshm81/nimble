import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { GA4ReportResponse } from '../../types/ga4.types';

function createAnalyticsClient(): BetaAnalyticsDataClient {
  const raw = config.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = raw ? JSON.parse(raw) : {};
  return new BetaAnalyticsDataClient({ credentials });
}

export const analyticsDataClient = createAnalyticsClient();

export async function runReport(
  propertyId: string,
  requestBody: object,
): Promise<GA4ReportResponse> {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    ...requestBody,
  });

  const quota = response.propertyQuota;
  if (quota) {
    const remaining = quota.tokensPerDay?.remaining ?? null;
    if (remaining !== null && remaining < 1000) {
      logger.warn({ platform: GA4_PLATFORM, tokensPerDayRemaining: remaining }, 'GA4 quota low');
    } else {
      logger.info({
        platform: GA4_PLATFORM,
        tokensPerDayRemaining: remaining,
        tokensPerHourRemaining: quota.tokensPerHour?.remaining ?? null,
      }, 'GA4 quota');
    }
  }

  return response as GA4ReportResponse;
}

export function parseRows<T>(
  response: GA4ReportResponse,
  mapper: (row: Record<string, string>) => T,
): T[] {
  if (!response.rows) return [];

  return response.rows.map((row) => {
    const named: Record<string, string> = {};

    (response.dimensionHeaders ?? []).forEach((h, i) => {
      named[h.name ?? ''] = row.dimensionValues?.[i]?.value ?? '';
    });

    (response.metricHeaders ?? []).forEach((h, i) => {
      named[h.name ?? ''] = row.metricValues?.[i]?.value ?? '0';
    });

    return mapper(named);
  });
}
