import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReport, parseRows } from './ga4Client';
import { GA4SessionRow } from '../../types/ga4.types';

export async function fetchSessions(date: string): Promise<GA4SessionRow[]> {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'deviceCategory' },
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
    source:            row['sessionSource'],
    medium:            row['sessionMedium'],
    campaign:          row['sessionCampaignName'],
    deviceCategory:    row['deviceCategory'],
    sessions:          parseInt(row['sessions'], 10),
    totalUsers:        parseInt(row['totalUsers'], 10),
    newUsers:          parseInt(row['newUsers'], 10),
    pageViews:         parseInt(row['screenPageViews'], 10),
    engagementSeconds: parseInt(row['userEngagementDuration'], 10),
  }));
}
