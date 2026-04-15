import { GA4SessionRow } from '../../types/ga4.types';
import { SessionInput } from '../../db/repositories/ga4Repo';
import { parseGa4Date } from './utils';

export function transformSession(
  raw: GA4SessionRow,
  propertyId: string,
  syncedAt: Date,
): SessionInput {
  return {
    propertyId,
    reportDate:        parseGa4Date(raw.date),
    source:            raw.source ?? '(not set)',
    medium:            raw.medium ?? '(not set)',
    campaign:          raw.campaign ?? '(not set)',
    deviceCategory:    raw.deviceCategory ?? '(not set)',
    sessions:          raw.sessions ? parseInt(raw.sessions, 10) : 0,
    totalUsers:        raw.totalUsers ? parseInt(raw.totalUsers, 10) : 0,
    newUsers:          raw.newUsers ? parseInt(raw.newUsers, 10) : 0,
    pageViews:         raw.pageViews ? parseInt(raw.pageViews, 10) : 0,
    engagementSeconds: raw.engagementSeconds ? Math.round(parseFloat(raw.engagementSeconds)) : 0,
    newVsReturning:    raw.newVsReturning ?? null,
    rawData:           raw,
    syncedAt,
  };
}
