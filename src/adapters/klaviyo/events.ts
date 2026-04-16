import { AxiosResponse } from 'axios';
import { URL } from 'url';
import { config } from '../../config';
import { KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { KlaviyoEvent, KlaviyoMetric } from '../../types/klaviyo.types';
import { klaviyoClient } from './klaviyoClient';

type EventPage = {
  data: KlaviyoEvent[];
  included: KlaviyoMetric[] | null;
  links: { next: string | null };
};

async function getPage(url: string, params?: Record<string, string | number>): Promise<AxiosResponse<EventPage>> {
  return klaviyoClient.get<EventPage>(url, params ? { params } : undefined);
}

function toRelativePath(fullUrl: string): string {
  const parsed = new URL(fullUrl);
  // Klaviyo links.next returns full paths like /api/events?...
  // baseURL is already https://a.klaviyo.com/api — strip the leading /api to avoid /api/api/...
  const path = parsed.pathname.replace(/^\/api/, '');
  return path + parsed.search;
}

export async function fetchEvents(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoEvent[]) => Promise<void>,
): Promise<void> {
  // Metric name lookup map accumulated across ALL pages — Klaviyo only includes a metric
  // resource on the page where it first appears. Events on later pages reference the same
  // metric ID, so the map must persist for the full fetch, not just one page.
  const metricNameById = new Map<string, string>();

  const filterParts: string[] = [];

  if (lastSyncedAt) {
    filterParts.push(`greater-than(datetime,${lastSyncedAt.toISOString()})`);
  }

  const rawEventTypes = config.KLAVIYO_SYNC_EVENT_TYPES ?? '';
  const eventTypes = rawEventTypes
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (eventTypes.length === 1) {
    filterParts.push(`equals(metric.name,'${eventTypes[0]}')`);
  } else if (eventTypes.length > 1) {
    const metricFilter = eventTypes.map((name) => `equals(metric.name,'${name}')`).join(',');
    filterParts.push(`or(${metricFilter})`);
  }

  // page[size] not supported in revision 2026-04-15 — cursor-only pagination
  const params: Record<string, string> = {
    include: 'metric',
    ...(filterParts.length === 1 && { filter: filterParts[0] }),
    ...(filterParts.length > 1 && { filter: `and(${filterParts.join(',')})` }),
  };

  let nextUrl: string | null = null;
  let totalCount = 0;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/events', nextUrl ? undefined : params);

    // Accumulate metric names from included resources — persists across pages
    for (const metric of response.data.included ?? []) {
      if (metric.attributes.name) {
        metricNameById.set(metric.id, metric.attributes.name);
      }
    }

    const page = response.data.data;

    // Stamp metric_name onto each event in this page using the accumulated map
    for (const event of page) {
      const metricId = event.relationships?.metric?.data?.id ?? null;
      if (metricId) {
        event.attributes.metric_name = metricNameById.get(metricId) ?? null;
      }
    }

    if (page.length > 0) {
      await onPage(page);
      totalCount += page.length;
    }

    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'events', count: totalCount },
    'fetched',
  );
}
