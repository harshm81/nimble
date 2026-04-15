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
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { config } from '../config';

if (!config.CIN7_ENABLED) {
  logger.warn({ platform: CIN7_PLATFORM }, 'cin7 disabled — worker not started');
} else {
new Worker(
  CIN7_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: CIN7_PLATFORM, jobName: job.name }, 'job started');
    const queuedId = await logQueued(CIN7_PLATFORM, job.name);
    const syncLog = await logRunning(queuedId);

    try {
      const lastSyncedAt = await getLastSyncedAt(CIN7_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case CIN7_JOBS.ORDERS: {
          const raw = await fetchOrders(lastSyncedAt);
          const orders = raw.map((r) => transformOrder(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformOrderLineItems(r, syncedAt));
          const recordsSaved = await upsertOrders(orders);
          await upsertOrderLineItems(lineItems);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.CONTACTS: {
          const raw = await fetchContacts(lastSyncedAt);
          const rows = raw.map((r) => transformContact(r, syncedAt));
          const recordsSaved = await upsertContacts(rows);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.PRODUCTS: {
          const raw = await fetchProducts(lastSyncedAt);
          const rows = raw.map((r) => transformProduct(r, syncedAt));
          const recordsSaved = await upsertProducts(rows);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.INVENTORY: {
          // Inventory has no updatedDate — it is a full snapshot each sync
          const raw = await fetchInventory();
          const rows = raw.map((r) => transformInventory(r, syncedAt));
          const recordsSaved = await upsertInventory(rows);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.PURCHASE_ORDERS: {
          const raw = await fetchPurchaseOrders(lastSyncedAt);
          const rows = raw.map((r) => transformPurchaseOrder(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformPurchaseOrderLineItems(r, syncedAt));
          const recordsSaved = await upsertPurchaseOrders(rows);
          await upsertPurchaseOrderLineItems(lineItems);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.CREDIT_NOTES: {
          const raw = await fetchCreditNotes(lastSyncedAt);
          const rows = raw.map((r) => transformCreditNote(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformCreditNoteLineItems(r, syncedAt));
          const recordsSaved = await upsertCreditNotes(rows);
          await upsertCreditNoteLineItems(lineItems);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.STOCK_ADJUSTMENTS: {
          const raw = await fetchStockAdjustments(lastSyncedAt);
          const rows = raw.map((r) => transformStockAdjustment(r, syncedAt));
          const lineItems = raw.flatMap((r) => transformStockAdjustmentLineItems(r, syncedAt));
          const recordsSaved = await upsertStockAdjustments(rows);
          await upsertStockAdjustmentLineItems(lineItems);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.modifiedDate) return max;
            const d = new Date(r.modifiedDate);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case CIN7_JOBS.BRANCHES: {
          // Branches have no updatedDate — it is a full snapshot each sync
          const raw = await fetchBranches();
          const rows = raw.map((r) => transformBranch(r, syncedAt));
          const recordsSaved = await upsertBranches(rows);
          await setLastSyncedAt(CIN7_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logFailure(syncLog.id, {
        errorMessage: errorMessage,
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
