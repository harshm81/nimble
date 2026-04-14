import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReport, parseRows } from './ga4Client';
import { GA4EcommerceEventRow } from '../../types/ga4.types';

export async function fetchEcommerceEvents(date: string): Promise<GA4EcommerceEventRow[]> {
  const response = await runReport(config.GA4_PROPERTY_ID ?? '', {
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
    eventName:      row['eventName'],
    source:         row['sessionSource'],
    medium:         row['sessionMedium'],
    transactions:   parseInt(row['transactions'], 10),
    revenue:        parseFloat(row['purchaseRevenue']),
    addToCarts:     parseInt(row['addToCarts'], 10),
    checkouts:      parseInt(row['checkouts'], 10),
    // eventCount captures view_item occurrences; for purchase/cart/checkout rows it will be 0
    viewItemEvents: row['eventName'] === 'view_item' ? parseInt(row['eventCount'], 10) : 0,
  }));
}
