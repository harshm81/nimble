import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { GA4_PLATFORM, GA4_QUEUE, GA4_JOBS } from '../constants/ga4';
import { config } from '../config';
import { fetchSessions } from '../adapters/ga4/sessions';
import { fetchEcommerceEvents } from '../adapters/ga4/ecommerceEvents';
import { fetchProductData } from '../adapters/ga4/productData';
import { transformSession } from '../transform/ga4/sessionTransformer';
import { transformEcommerceEvent } from '../transform/ga4/ecommerceEventTransformer';
import { transformProductData } from '../transform/ga4/productDataTransformer';
import { upsertSessions, upsertEcommerceEvents, upsertProductData } from '../db/repositories/ga4Repo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

if (!config.GA4_ENABLED) {
  logger.warn({ platform: GA4_PLATFORM }, 'ga4 disabled — worker not started');
} else {
new Worker(
  GA4_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: GA4_PLATFORM, job: job.name }, 'job started');

    const queuedId = await logQueued(GA4_PLATFORM, job.name);
    const syncLog = await logRunning(queuedId);

    try {
      const syncedAt = new Date();

      switch (job.name) {
        case GA4_JOBS.DAILY: {
          const propertyId = config.GA4_PROPERTY_ID ?? '';
          const lastSyncedAt = await getLastSyncedAt(GA4_PLATFORM, job.name);
          const dates = getDateRange(lastSyncedAt);

          let totalFetched = 0;
          let totalSaved = 0;

          for (const date of dates) {
            const [rawSessions, rawEcommerce, rawProducts] = await Promise.all([
              fetchSessions(date),
              fetchEcommerceEvents(date),
              fetchProductData(date),
            ]);

            const sessionRows = rawSessions.map((r) => transformSession(r, propertyId, syncedAt));
            const ecommerceRows = rawEcommerce.map((r) => transformEcommerceEvent(r, propertyId, syncedAt));
            const productRows = rawProducts.map((r) => transformProductData(r, propertyId, syncedAt));

            const sessionsSaved = await upsertSessions(sessionRows);
            const ecommerceSaved = await upsertEcommerceEvents(ecommerceRows);
            const productsSaved = await upsertProductData(productRows);

            totalFetched += rawSessions.length + rawEcommerce.length + rawProducts.length;
            totalSaved += sessionsSaved + ecommerceSaved + productsSaved;

            logger.info({ platform: GA4_PLATFORM, date, sessionsSaved, ecommerceSaved, productsSaved }, 'ga4 date synced');
          }

          const lastDate = new Date(dates[dates.length - 1] + 'T00:00:00.000Z');
          await setLastSyncedAt(GA4_PLATFORM, job.name, lastDate);

          await logSuccess(syncLog.id, {
            recordsFetched: totalFetched,
            recordsSaved: totalSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });

          break;
        }

        default:
          throw new Error(`ga4Worker: unknown job name: ${job.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logFailure(syncLog.id, {
        errorMessage,
        durationMs: Date.now() - startedAt,
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 1000 },
  },
);
}

// Returns all dates from the day after lastSyncedAt up to and including yesterday.
// On first run (lastSyncedAt === null): uses GA4_HISTORICAL_START_DATE if set, otherwise 90 days ago.
function getDateRange(lastSyncedAt: Date | null): string[] {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const start = lastSyncedAt
    ? new Date(lastSyncedAt)
    : config.GA4_HISTORICAL_START_DATE
      ? new Date(config.GA4_HISTORICAL_START_DATE + 'T00:00:00.000Z')
      : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 90); return d; })();
  start.setUTCHours(0, 0, 0, 0);
  if (lastSyncedAt) {
    start.setUTCDate(start.getUTCDate() + 1); // day after last successful sync
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= yesterday) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
