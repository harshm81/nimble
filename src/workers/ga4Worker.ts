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
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';

if (!config.GA4_ENABLED) {
  logger.warn({ platform: GA4_PLATFORM }, 'ga4 disabled — worker not started');
} else {
const ga4Worker = new Worker(
  GA4_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: GA4_PLATFORM, job: job.name }, 'job started');

    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(GA4_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      const syncedAt = new Date();

      switch (job.name) {
        case GA4_JOBS.DAILY: {
          const propertyId = config.GA4_PROPERTY_ID ?? '';
          const lastSyncedAt = await getLastSyncedAt(GA4_PLATFORM, job.name);
          const dates = getDateRange(lastSyncedAt);

          if (dates.length === 0) {
            logger.info({ platform: GA4_PLATFORM, job: job.name }, 'ga4 already up to date — no new dates to sync');
            await logSuccess(syncLog.id, { recordsFetched: 0, recordsSaved: 0, recordsSkipped: 0, durationMs: Date.now() - startedAt });
            break;
          }

          if (!lastSyncedAt && !config.GA4_HISTORICAL_START_DATE) {
            logger.warn({ platform: GA4_PLATFORM }, 'GA4_HISTORICAL_START_DATE not set — defaulting to 90 days; set this env var to sync full history');
          }

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

            // Advance cursor per date — if job fails mid-backfill, next retry resumes
            // from the failed date instead of replaying all already-synced dates.
            await setLastSyncedAt(GA4_PLATFORM, job.name, new Date(date + 'T00:00:00.000Z'));
          }

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
      if (syncLog) {
        try {
          await logFailure(syncLog.id, {
            errorMessage: extractErrorMessage(error),
            durationMs: Date.now() - startedAt,
          });
        } catch (logErr) {
          logger.error({ err: logErr }, 'failed to update sync_log on job failure');
        }
      }
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 3600000, // 60 min — 90-day backfill (270 API calls) exceeds the 30s default on first run
    limiter: { max: 5, duration: 1000 },
  },
);

ga4Worker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(GA4_PLATFORM, jobName);
    logger.warn({ platform: GA4_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: GA4_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
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
