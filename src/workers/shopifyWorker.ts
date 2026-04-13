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

export const shopifyWorker = new Worker(
  SHOPIFY_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: SHOPIFY_PLATFORM, job: job.name }, 'job started');
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
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
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
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
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
          const recordsSaved = await upsertProducts(rows);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          // Inventory and variants are not cron-scheduled — enqueue after products complete
          await shopifyQueue.add(SHOPIFY_JOBS.INVENTORY, {}, {
            jobId: `${SHOPIFY_JOBS.INVENTORY}:${Date.now()}`,
          });
          await shopifyQueue.add(SHOPIFY_JOBS.PRODUCT_VARIANTS, {}, {
            jobId: `${SHOPIFY_JOBS.PRODUCT_VARIANTS}:${Date.now()}`,
          });
          break;
        }

        case SHOPIFY_JOBS.INVENTORY: {
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
          const raw = await fetchProducts(lastSyncedAt);
          const variants = raw.flatMap((r) => transformProductVariants(r, syncedAt));
          const recordsSaved = await upsertProductVariants(variants);
          await setLastSyncedAt(SHOPIFY_PLATFORM, job.name, syncedAt);
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
