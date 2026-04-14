import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReportPaginated, parseRows } from './ga4Client';
import { GA4EcommerceEventRow } from '../../types/ga4.types';

export async function fetchEcommerceEvents(date: string): Promise<GA4EcommerceEventRow[]> {
  const response = await runReportPaginated(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'eventName' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'transactions' },
      { name: 'purchaseRevenue' },
      { name: 'addToCarts' },
      { name: 'checkouts' },
      { name: 'eventCount' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['add_to_cart', 'begin_checkout', 'purchase', 'view_item'],
        },
      },
    },
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'ecommerceEvents', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:           row['date'],
    eventName:      row['eventName'] || null,
    source:         row['sessionSource'] || null,
    medium:         row['sessionMedium'] || null,
    transactions:   row['transactions'] || null,
    revenue:        row['purchaseRevenue'] || null,
    addToCarts:     row['addToCarts'] || null,
    checkouts:      row['checkouts'] || null,
    viewItemEvents: row['eventName'] === 'view_item' ? (row['eventCount'] || null) : null,
  }));
}
