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

// Fetches all metrics and returns a map of name → id.
// Used to resolve KLAVIYO_SYNC_EVENT_TYPES names to IDs before filtering events,
// because /events only supports filtering by metric_id, not metric.name.
async function fetchMetricIdsByName(): Promise<Map<string, string>> {
  type MetricPage = { data: Array<{ id: string; attributes: { name: string | null } }>; links: { next: string | null } };
  const map = new Map<string, string>();
  let cursor: string | null = '/metrics';
  while (cursor) {
    const page: { data: MetricPage } = await klaviyoClient.get<MetricPage>(cursor);
    for (const m of page.data.data) {
      if (m.attributes.name) map.set(m.attributes.name, m.id);
    }
    const next: string | null = page.data.links?.next ?? null;
    cursor = next ? toRelativePath(next) : null;
  }
  return map;
}

// Fetches all pages for a single metric_id (or no metric filter) and calls onPage for each.
// metricNameById is shared across all fetchEventsForMetric calls so metric names accumulated
// on earlier pages remain available when stamping events on later pages.
async function fetchEventsForMetric(
  filterParts: string[],
  metricNameById: Map<string, string>,
  onPage: (page: KlaviyoEvent[]) => Promise<void>,
): Promise<number> {
  // page[size] not supported in revision 2026-04-15 — cursor-only pagination
  const params: Record<string, string> = {
    include: 'metric',
    ...(filterParts.length === 1 && { filter: filterParts[0] }),
    ...(filterParts.length > 1 && { filter: `and(${filterParts.join(',')})` }),
  };

  let nextUrl: string | null = null;
  let count = 0;

  do {
    const response = await getPage(nextUrl ? toRelativePath(nextUrl) : '/events', nextUrl ? undefined : params);

    // Accumulate metric names from included resources — persists across pages and across
    // per-metric fetches (Klaviyo only includes a metric resource on the page where it
    // first appears, so the map must survive the full fetch lifetime)
    for (const metric of response.data.included ?? []) {
      if (metric.attributes.name) {
        metricNameById.set(metric.id, metric.attributes.name);
      }
    }

    const page = response.data.data;

    for (const event of page) {
      const metricId = event.relationships?.metric?.data?.id ?? null;
      if (metricId) {
        event.attributes.metric_name = metricNameById.get(metricId) ?? null;
      }
    }

    if (page.length > 0) {
      await onPage(page);
      count += page.length;
    }

    nextUrl = response.data.links?.next ?? null;
  } while (nextUrl);

  return count;
}

export async function fetchEvents(
  lastSyncedAt: Date | null,
  onPage: (page: KlaviyoEvent[]) => Promise<void>,
): Promise<void> {
  // Shared map persists across all per-metric fetches — Klaviyo only includes a metric
  // resource on the page where it first appears, so names must survive the full run.
  const metricNameById = new Map<string, string>();

  const baseParts: string[] = [];
  if (lastSyncedAt) {
    baseParts.push(`greater-than(datetime,${lastSyncedAt.toISOString()})`);
  }

  const rawEventTypes = config.KLAVIYO_SYNC_EVENT_TYPES ?? '';
  const eventTypes = rawEventTypes
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let totalCount = 0;

  if (eventTypes.length === 0) {
    // No metric filter — fetch all events in one pass
    totalCount += await fetchEventsForMetric(baseParts, metricNameById, onPage);
  } else {
    // /events only supports equals(metric_id,'...') — no any() or or() operator.
    // Fetch one pass per metric ID and merge results via onPage.
    const metricIdsByName = await fetchMetricIdsByName();
    const ids = eventTypes
      .map((name) => metricIdsByName.get(name))
      .filter((id): id is string => id !== undefined);

    if (ids.length === 0) {
      logger.warn(
        { platform: KLAVIYO_PLATFORM, eventTypes },
        'no metric IDs found for configured event types — fetching all events',
      );
      totalCount += await fetchEventsForMetric(baseParts, metricNameById, onPage);
    } else {
      for (const id of ids) {
        const filterParts = [...baseParts, `equals(metric_id,'${id}')`];
        totalCount += await fetchEventsForMetric(filterParts, metricNameById, onPage);
      }
    }
  }

  logger.info(
    { platform: KLAVIYO_PLATFORM, module: 'events', count: totalCount },
    'fetched',
  );
}
