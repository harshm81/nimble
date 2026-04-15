import { Prisma } from '@prisma/client';
import { GA4EcommerceEventRow } from '../../types/ga4.types';
import { EcommerceEventInput } from '../../db/repositories/ga4Repo';
import { parseGa4Date } from './utils';

export function transformEcommerceEvent(
  raw: GA4EcommerceEventRow,
  propertyId: string,
  syncedAt: Date,
): EcommerceEventInput {
  return {
    propertyId,
    reportDate:     parseGa4Date(raw.date),
    eventName:      raw.eventName ?? '(not set)',
    source:         raw.source ?? '(not set)',
    medium:         raw.medium ?? '(not set)',
    transactions:   raw.transactions ? parseInt(raw.transactions, 10) : 0,
    revenue:        new Prisma.Decimal(raw.revenue ?? '0'),
    addToCarts:     raw.addToCarts ? parseInt(raw.addToCarts, 10) : 0,
    checkouts:      raw.checkouts ? parseInt(raw.checkouts, 10) : 0,
    rawData:        raw,
    syncedAt,
  };
}
