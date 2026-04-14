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
    source:            raw.source,
    medium:            raw.medium,
    campaign:          raw.campaign,
    deviceCategory:    raw.deviceCategory,
    sessions:          raw.sessions,
    totalUsers:        raw.totalUsers,
    newUsers:          raw.newUsers,
    pageViews:         raw.pageViews,
    engagementSeconds: raw.engagementSeconds,
    rawData:           raw,
    syncedAt,
  };
}

function parseGa4Date(yyyymmdd: string): Date {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}
