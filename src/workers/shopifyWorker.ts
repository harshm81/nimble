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
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { config } from '../config';

if (!config.SHOPIFY_ENABLED) {
  logger.warn({ platform: SHOPIFY_PLATFORM }, 'shopify disabled — worker not started');
} else {
new Worker(
  SHOPIFY_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: SHOPIFY_PLATFORM, jobName: job.name }, 'job started');
    const queuedId = await logQueued(SHOPIFY_PLATFORM, job.name);
    const syncLog = await logRunning(queuedId);

    try {
      const lastSyncedAt = await getLastSyncedAt(SHOPIFY_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case SHOPIFY_JOBS.ORDERS: {
          const raw = await fetchOrders(lastSyncedAt);
          const orders = raw.map((r) => transformOrder(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformOrderLineItems(r, syncedAt));
          const refunds = raw.flatMap((r) => transformRefunds(r, syncedAt));
          const recordsSaved = await upsertOrders(orders);
          await upsertOrderLineItems(lineItems);
          await upsertRefunds(refunds);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updatedAt) return max;
            const d = new Date(r.updatedAt);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case SHOPIFY_JOBS.CUSTOMERS: {
          const raw = await fetchCustomers(lastSyncedAt);
          const rows = raw.map((r) => transformCustomer(r, syncedAt));
          const recordsSaved = await upsertCustomers(rows);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updatedAt) return max;
            const d = new Date(r.updatedAt);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case SHOPIFY_JOBS.PRODUCTS: {
          const raw = await fetchProducts(lastSyncedAt);
          const rows = raw.map((r) => transformProduct(r, syncedAt));
          // Upsert variants in the same job — products and variants share the same fetch,
          // so no second API call is needed. PRODUCT_VARIANTS job is kept for manual re-runs.
          const variants = raw.flatMap((r) => transformProductVariants(r, syncedAt));
          const recordsSaved = await upsertProducts(rows);
          await upsertProductVariants(variants);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updatedAt) return max;
            const d = new Date(r.updatedAt);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
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
          const raw = await fetchInventory();
          const rows = raw.map((r) => transformInventory(r, syncedAt));
          const recordsSaved = await upsertInventory(rows);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
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
          const raw = await fetchProducts(lastSyncedAt);
          const variants = raw.flatMap((r) => transformProductVariants(r, syncedAt));
          const recordsSaved = await upsertProductVariants(variants);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updatedAt) return max;
            const d = new Date(r.updatedAt);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: variants.length,
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
    limiter: { max: 3, duration: 1000 },
  },
);
}
