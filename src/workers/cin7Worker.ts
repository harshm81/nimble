import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { CIN7_PLATFORM, CIN7_QUEUE, CIN7_JOBS } from '../constants/cin7';
import { fetchOrders } from '../adapters/cin7/orders';
import { fetchContacts } from '../adapters/cin7/contacts';
import { fetchProducts } from '../adapters/cin7/products';
import { fetchInventory } from '../adapters/cin7/inventory';
import { fetchPurchaseOrders } from '../adapters/cin7/purchaseOrders';
import { fetchCreditNotes } from '../adapters/cin7/creditNotes';
import { fetchStockAdjustments } from '../adapters/cin7/stockAdjustments';
import { fetchBranches } from '../adapters/cin7/branches';
import { transformOrder, transformOrderLineItems } from '../transform/cin7/orderTransformer';
import { transformContact } from '../transform/cin7/contactTransformer';
import { transformProduct } from '../transform/cin7/productTransformer';
import { transformInventory } from '../transform/cin7/inventoryTransformer';
import { transformPurchaseOrder, transformPurchaseOrderLineItems } from '../transform/cin7/purchaseOrderTransformer';
import { transformCreditNote, transformCreditNoteLineItems } from '../transform/cin7/creditNoteTransformer';
import { transformStockAdjustment, transformStockAdjustmentLineItems } from '../transform/cin7/stockAdjustmentTransformer';
import { transformBranch } from '../transform/cin7/branchTransformer';
import {
  upsertOrders,
  upsertOrderLineItems,
  upsertContacts,
  upsertProducts,
  upsertInventory,
  upsertPurchaseOrders,
  upsertPurchaseOrderLineItems,
  upsertCreditNotes,
  upsertCreditNoteLineItems,
  upsertStockAdjustments,
  upsertStockAdjustmentLineItems,
  upsertBranches,
} from '../db/repositories/cin7Repo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { config } from '../config';

if (!config.CIN7_ENABLED) {
  logger.warn({ platform: CIN7_PLATFORM }, 'cin7 disabled — worker not started');
} else {
const cin7Worker = new Worker(
  CIN7_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: CIN7_PLATFORM, jobName: job.name }, 'job started');
    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(CIN7_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      const lastSyncedAt = await getLastSyncedAt(CIN7_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case CIN7_JOBS.ORDERS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchOrders(lastSyncedAt, async (page) => {
            const orders = page.map((r) => transformOrder(r, syncedAt));
            const lineItems = page.flatMap((r) => transformOrderLineItems(r, syncedAt));
            recordsSaved += await upsertOrders(orders);
            await upsertOrderLineItems(lineItems);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.CONTACTS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchContacts(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformContact(r, syncedAt));
            recordsSaved += await upsertContacts(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.PRODUCTS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchProducts(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformProduct(r, syncedAt));
            recordsSaved += await upsertProducts(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.INVENTORY: {
          // Inventory has no updatedDate — it is a full snapshot each sync
          let recordsFetched = 0;
          let recordsSaved = 0;

          await fetchInventory(async (page) => {
            const rows = page.map((r) => transformInventory(r, syncedAt));
            recordsSaved += await upsertInventory(rows);
            recordsFetched += page.length;
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.PURCHASE_ORDERS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchPurchaseOrders(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformPurchaseOrder(r, syncedAt));
            const lineItems = page.flatMap((r) => transformPurchaseOrderLineItems(r, syncedAt));
            recordsSaved += await upsertPurchaseOrders(rows);
            await upsertPurchaseOrderLineItems(lineItems);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.CREDIT_NOTES: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchCreditNotes(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformCreditNote(r, syncedAt));
            const lineItems = page.flatMap((r) => transformCreditNoteLineItems(r, syncedAt));
            recordsSaved += await upsertCreditNotes(rows);
            await upsertCreditNoteLineItems(lineItems);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.STOCK_ADJUSTMENTS: {
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchStockAdjustments(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformStockAdjustment(r, syncedAt));
            const lineItems = page.flatMap((r) => transformStockAdjustmentLineItems(r, syncedAt));
            recordsSaved += await upsertStockAdjustments(rows);
            await upsertStockAdjustmentLineItems(lineItems);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.modifiedDate) continue;
              const d = new Date(r.modifiedDate);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.BRANCHES: {
          // Branches have no updatedDate — it is a full snapshot each sync
          let recordsFetched = 0;
          let recordsSaved = 0;

          await fetchBranches(async (page) => {
            const rows = page.map((r) => transformBranch(r, syncedAt));
            recordsSaved += await upsertBranches(rows);
            recordsFetched += page.length;
          });

          await setLastSyncedAt(CIN7_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        default:
          throw new Error(`cin7Worker: unknown job name: ${job.name}`);
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
    lockDuration: 3600000, // 60 min — initial full sync across large ERP datasets exceeds default lock
    limiter: { max: 3, duration: 1000 },
  },
);

cin7Worker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(CIN7_PLATFORM, jobName);
    logger.warn({ platform: CIN7_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: CIN7_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
}
