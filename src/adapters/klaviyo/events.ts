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
  return parsed.pathname + parsed.search;
}

export async function fetchEvents(lastSyncedAt: Date | null): Promise<KlaviyoEvent[]> {
  const results: KlaviyoEvent[] = [];
  // Accumulate metric name lookups across all pages
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

  const params: Record<string, string | number> = {
    'page[size]': 1000, // API maximum — reduces requests 10x vs default 100
    include: 'metric',
    ...(filterParts.length === 1 && { filter: filterParts[0] }),
    ...(filterParts.length > 1 && { filter: `and(${filterParts.join(',')})` }),
  };

  let nextUrl: string | null = null;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/events', nextUrl ? undefined : params);

    // Index metric names from included resources on every page
    for (const metric of response.data.included ?? []) {
      if (metric.attributes.name) {
        metricNameById.set(metric.id, metric.attributes.name);
      }
    }

    results.push(...response.data.data);
    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  // Stamp metric_name onto each event using the accumulated lookup map
  for (const event of results) {
    const metricId = event.relationships?.metric?.data?.id ?? null;
    if (metricId) {
      event.attributes.metric_name = metricNameById.get(metricId) ?? null;
    }
  }

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'events', count: results.length },
    'fetched',
  );

  return results;
}
