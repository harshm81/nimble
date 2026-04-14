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
import { setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

export const ga4Worker = new Worker(
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
          const date = getYesterdayDate();
          const propertyId = config.GA4_PROPERTY_ID ?? '';

          const [rawSessions, rawEcommerce, rawProducts] = await Promise.all([
            fetchSessions(date),
            fetchEcommerceEvents(date),
            fetchProductData(date),
          ]);

          const sessionRows = rawSessions.map((r) =>
            transformSession(r, propertyId, syncedAt),
          );

          const ecommerceRows = rawEcommerce.map((r) =>
            transformEcommerceEvent(r, propertyId, syncedAt),
          );

          const productRows = rawProducts.map((r) =>
            transformProductData(r, propertyId, syncedAt),
          );

          const sessionsSaved = await upsertSessions(sessionRows);
          const ecommerceSaved = await upsertEcommerceEvents(ecommerceRows);
          const productsSaved = await upsertProductData(productRows);

          await setLastSyncedAt(GA4_PLATFORM, job.name, syncedAt);

          await logSuccess(syncLog.id, {
            recordsFetched: rawSessions.length + rawEcommerce.length + rawProducts.length,
            recordsSaved: sessionsSaved + ecommerceSaved + productsSaved,
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

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
