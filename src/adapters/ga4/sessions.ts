import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReportPaginated, parseRows } from './ga4Client';
import { GA4SessionRow } from '../../types/ga4.types';

export async function fetchSessions(date: string): Promise<GA4SessionRow[]> {
  const response = await runReportPaginated(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'deviceCategory' },
      { name: 'newVsReturning' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'userEngagementDuration' },
    ],
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'sessions', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:              row['date'],
    source:            row['sessionSource'] || null,
    medium:            row['sessionMedium'] || null,
    campaign:          row['sessionCampaignName'] || null,
    deviceCategory:    row['deviceCategory'] || null,
    newVsReturning:    row['newVsReturning'] || null,
    sessions:          row['sessions'] || null,
    totalUsers:        row['totalUsers'] || null,
    newUsers:          row['newUsers'] || null,
    pageViews:         row['screenPageViews'] || null,
    engagementSeconds: row['userEngagementDuration'] || null,
  }));
}
