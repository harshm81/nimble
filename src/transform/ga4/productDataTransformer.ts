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
    itemBrand:      raw.itemBrand ?? null,
    itemCategory:   raw.itemCategory ?? null,
    itemListViews:  raw.itemListViews ? parseInt(raw.itemListViews, 10) : 0,
    itemListClicks: raw.itemListClicks ? parseInt(raw.itemListClicks, 10) : 0,
    itemViews:      raw.itemViews ? parseInt(raw.itemViews, 10) : 0,
    addToCarts:     raw.addToCarts ? parseInt(raw.addToCarts, 10) : 0,
    purchases:      raw.purchases ? parseInt(raw.purchases, 10) : 0,
    revenue:        raw.revenue ? parseFloat(raw.revenue) : 0,
    rawData:        raw,
    syncedAt,
  };
}

function parseGa4Date(yyyymmdd: string | null | undefined): Date {
  if (!yyyymmdd) throw new Error('GA4 row missing required date field');
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}
