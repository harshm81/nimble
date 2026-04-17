import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { shopifyQueue } from '../queue/queues';
import { SHOPIFY_PLATFORM, SHOPIFY_QUEUE, SHOPIFY_JOBS } from '../constants/shopify';
import { fetchOrders } from '../adapters/shopify/orders';
import { fetchCustomers } from '../adapters/shopify/customers';
import { fetchProducts } from '../adapters/shopify/products';
import { fetchInventory } from '../adapters/shopify/inventory';
import { transformOrder, transformOrderLineItems, transformRefunds } from '../transform/shopify/orderTransformer';
import { transformCustomer } from '../transform/shopify/customerTransformer';
import { transformProduct } from '../transform/shopify/productTransformer';
import { transformProductVariants } from '../transform/shopify/productVariantTransformer';
import { transformInventory } from '../transform/shopify/inventoryTransformer';
import {
  upsertOrders,
  upsertOrderLineItems,
  upsertRefunds,
  upsertCustomers,
  upsertProducts,
  upsertProductVariants,
  upsertInventory,
} from '../db/repositories/shopifyRepo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { config } from '../config';

if (!config.SHOPIFY_ENABLED) {
  logger.warn({ platform: SHOPIFY_PLATFORM }, 'shopify disabled — worker not started');
} else {
const shopifyWorker = new Worker(
  SHOPIFY_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: SHOPIFY_PLATFORM, jobName: job.name }, 'job started');
    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(SHOPIFY_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      const lastSyncedAt = await getLastSyncedAt(SHOPIFY_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case SHOPIFY_JOBS.ORDERS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchOrders(lastSyncedAt, async (page) => {
            const orders    = page.map((r) => transformOrder(r, syncedAt));
            const lineItems = page.flatMap((r) => transformOrderLineItems(r, syncedAt));
            const refunds   = page.flatMap((r) => transformRefunds(r, syncedAt));
            recordsSaved += await upsertOrders(orders);
            await upsertOrderLineItems(lineItems);
            await upsertRefunds(refunds);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updatedAt) continue;
              const d = new Date(r.updatedAt);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case SHOPIFY_JOBS.CUSTOMERS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchCustomers(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformCustomer(r, syncedAt));
            recordsSaved += await upsertCustomers(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updatedAt) continue;
              const d = new Date(r.updatedAt);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case SHOPIFY_JOBS.PRODUCTS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          // Upsert variants in the same job — products and variants share the same fetch,
          // so no second API call is needed. PRODUCT_VARIANTS job is kept for manual re-runs.
          await fetchProducts(lastSyncedAt, async (page) => {
            const rows     = page.map((r) => transformProduct(r, syncedAt));
            const variants = page.flatMap((r) => transformProductVariants(r, syncedAt));
            recordsSaved += await upsertProducts(rows);
            await upsertProductVariants(variants);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updatedAt) continue;
              const d = new Date(r.updatedAt);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          // Inventory is not cron-scheduled — enqueue after products complete
          await shopifyQueue.add(SHOPIFY_JOBS.INVENTORY, {}, {
            jobId: `${SHOPIFY_JOBS.INVENTORY}:${Date.now()}`,
          });
          break;
        }

        case SHOPIFY_JOBS.INVENTORY: {
          // Inventory has no updatedAt — it is a full snapshot each sync
          let recordsFetched = 0;
          let recordsSaved = 0;

          await fetchInventory(async (page) => {
            const rows = page.map((r) => transformInventory(r, syncedAt));
            recordsSaved += await upsertInventory(rows);
            recordsFetched += page.length;
          });

          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case SHOPIFY_JOBS.PRODUCT_VARIANTS: {
          // Standalone re-run path — fetches products again to extract variants.
          // During normal cron sync this case is not reached; variants are upserted
          // inside the PRODUCTS case above to avoid a redundant API call.
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchProducts(lastSyncedAt, async (page) => {
            const variants = page.flatMap((r) => transformProductVariants(r, syncedAt));
            recordsSaved += await upsertProductVariants(variants);
            recordsFetched += variants.length;
            for (const r of page) {
              if (!r.updatedAt) continue;
              const d = new Date(r.updatedAt);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        default:
          throw new Error(`shopifyWorker: unknown job name: ${job.name}`);
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
    lockDuration: 3600000, // 60 min — orders + products with variants exceed the 30s default on first run
    limiter: { max: 3, duration: 1000 },
  },
);

shopifyWorker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(SHOPIFY_PLATFORM, jobName);
    logger.warn({ platform: SHOPIFY_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: SHOPIFY_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
}
