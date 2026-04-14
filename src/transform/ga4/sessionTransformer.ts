import { GA4SessionRow } from '../../types/ga4.types';
import { SessionInput } from '../../db/repositories/ga4Repo';

export function transformSession(
  raw: GA4SessionRow,
  propertyId: string,
  syncedAt: Date,
): SessionInput {
  return {
    propertyId,
    reportDate:        parseGa4Date(raw.date),
    source:            raw.source ?? '',
    medium:            raw.medium ?? '',
    campaign:          raw.campaign ?? '',
    deviceCategory:    raw.deviceCategory ?? '',
    sessions:          raw.sessions ? parseInt(raw.sessions, 10) : 0,
    totalUsers:        raw.totalUsers ? parseInt(raw.totalUsers, 10) : 0,
    newUsers:          raw.newUsers ? parseInt(raw.newUsers, 10) : 0,
    pageViews:         raw.pageViews ? parseInt(raw.pageViews, 10) : 0,
    engagementSeconds: raw.engagementSeconds ? parseInt(raw.engagementSeconds, 10) : 0,
    rawData:           raw,
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
