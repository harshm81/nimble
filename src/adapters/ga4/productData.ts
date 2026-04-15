import { config } from '../../config';
import { GA4_PLATFORM } from '../../constants/ga4';
import { logger } from '../../utils/logger';
import { runReportPaginated, parseRows } from './ga4Client';
import { GA4ProductDataRow } from '../../types/ga4.types';

export async function fetchProductData(date: string): Promise<GA4ProductDataRow[]> {
  const response = await runReportPaginated(config.GA4_PROPERTY_ID ?? '', {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'date' },
      { name: 'itemId' },
      { name: 'itemName' },
      { name: 'itemBrand' },
      { name: 'itemCategory' },
    ],
    metrics: [
      { name: 'itemListViews' },
      { name: 'itemListClicks' },
      { name: 'itemViews' },
      { name: 'addToCarts' },
      { name: 'itemPurchases' },
      { name: 'itemRevenue' },
    ],
    returnPropertyQuota: true,
  });

  logger.info({ platform: GA4_PLATFORM, module: 'productData', rows: response.rowCount }, 'fetched');

  return parseRows(response, (row) => ({
    date:           row['date'],
    itemId:         row['itemId'] || null,
    itemName:       row['itemName'] || null,
    itemBrand:      row['itemBrand'] || null,
    itemCategory:   row['itemCategory'] || null,
    itemListViews:  row['itemListViews'] || null,
    itemListClicks: row['itemListClicks'] || null,
    itemViews:      row['itemViews'] || null,
    addToCarts:     row['addToCarts'] || null,
    purchases:      row['itemPurchases'] || null,
    revenue:        row['itemRevenue'] || null,
  }));
}
