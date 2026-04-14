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

const GA4_PAGE_SIZE = 100_000; // API maximum rows per response

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

// runReport returns at most 100,000 rows per call. For reports that may exceed this,
// use runReportPaginated — it issues additional requests with offset until all rows are fetched.
export async function runReportPaginated(
  propertyId: string,
  requestBody: object,
): Promise<GA4ReportResponse> {
  const first = await runReport(propertyId, {
    ...requestBody,
    limit: GA4_PAGE_SIZE,
    offset: 0,
  });

  const totalRows = first.rowCount ?? 0;
  const fetchedRows = first.rows?.length ?? 0;

  if (fetchedRows >= totalRows) {
    return first;
  }

  // More pages exist — collect remaining rows
  logger.info({ platform: GA4_PLATFORM, totalRows, fetchedRows }, 'GA4 report has multiple pages — fetching remaining');

  const allRows = [...(first.rows ?? [])];
  let offset = fetchedRows;

  while (offset < totalRows) {
    const page = await runReport(propertyId, {
      ...requestBody,
      limit: GA4_PAGE_SIZE,
      offset,
    });
    allRows.push(...(page.rows ?? []));
    offset += page.rows?.length ?? 0;
  }

  return {
    ...first,
    rows: allRows,
  };
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
