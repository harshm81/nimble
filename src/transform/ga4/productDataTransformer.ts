import { GA4ProductDataRow } from '../../types/ga4.types';
import { ProductDataInput } from '../../db/repositories/ga4Repo';

export function transformProductData(
  raw: GA4ProductDataRow,
  propertyId: string,
  syncedAt: Date,
): ProductDataInput {
  return {
    propertyId,
    reportDate:     parseGa4Date(raw.date),
    itemId:         raw.itemId ?? '(not set)',
    itemName:       raw.itemName ?? '(not set)',
    itemBrand:      raw.itemBrand,
    itemCategory:   raw.itemCategory,
    itemListViews:  raw.itemListViews,
    itemListClicks: raw.itemListClicks,
    itemViews:      raw.itemViews,
    addToCarts:     raw.addToCarts,
    purchases:      raw.purchases,
    revenue:        raw.revenue,
    rawData:        raw,
    syncedAt,
  };
}

function parseGa4Date(yyyymmdd: string): Date {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}
