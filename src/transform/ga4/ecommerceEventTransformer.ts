import { GA4EcommerceEventRow } from '../../types/ga4.types';
import { EcommerceEventInput } from '../../db/repositories/ga4Repo';

export function transformEcommerceEvent(
  raw: GA4EcommerceEventRow,
  propertyId: string,
  syncedAt: Date,
): EcommerceEventInput {
  return {
    propertyId,
    reportDate:     parseGa4Date(raw.date),
    eventName:      raw.eventName,
    source:         raw.source,
    medium:         raw.medium,
    transactions:   raw.transactions,
    revenue:        raw.revenue,
    addToCarts:     raw.addToCarts,
    checkouts:      raw.checkouts,
    viewItemEvents: raw.viewItemEvents,
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
