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
    eventName:      raw.eventName ?? '',
    source:         raw.source ?? '',
    medium:         raw.medium ?? '',
    transactions:   raw.transactions ? parseInt(raw.transactions, 10) : 0,
    revenue:        raw.revenue ? parseFloat(raw.revenue) : 0,
    addToCarts:     raw.addToCarts ? parseInt(raw.addToCarts, 10) : 0,
    checkouts:      raw.checkouts ? parseInt(raw.checkouts, 10) : 0,
    viewItemEvents: raw.viewItemEvents ? parseInt(raw.viewItemEvents, 10) : 0,
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
