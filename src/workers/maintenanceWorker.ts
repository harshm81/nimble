import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { MAINTENANCE_PLATFORM, MAINTENANCE_QUEUE, MAINTENANCE_JOBS } from '../constants/maintenance';
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { writeDailySummary } from '../db/repositories/syncSummaryRepo';
// import { cleanupOldLogs } from '../db/repositories/syncSummaryRepo';

export const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: MAINTENANCE_PLATFORM, job: job.name }, 'job started');
    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(MAINTENANCE_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      switch (job.name) {
        case MAINTENANCE_JOBS.DAILY_SUMMARY: {
          await writeDailySummary(new Date());
          await logSuccess(syncLog.id, {
            recordsFetched: 0,
            recordsSaved: 0,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          logger.info({ platform: MAINTENANCE_PLATFORM, durationMs: Date.now() - startedAt }, 'daily summary written');
          break;
        }

        // Disabled: sync logs are kept indefinitely for debugging. Uncomment to re-enable 90-day cleanup.
        // case MAINTENANCE_JOBS.CLEANUP_LOGS: {
        //   const deleted = await cleanupOldLogs();
        //   await logSuccess(syncLog.id, {
        //     recordsFetched: 0,
        //     recordsSaved: 0,
        //     recordsSkipped: 0,
        //     durationMs: Date.now() - startedAt,
        //   });
        //   logger.info({ platform: MAINTENANCE_PLATFORM, deleted, durationMs: Date.now() - startedAt }, 'old sync_logs cleaned up');
        //   break;
        // }

        default:
          throw new Error(`maintenanceWorker: unknown job name: ${job.name}`);
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
  { connection, concurrency: 1 },
);

maintenanceWorker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(MAINTENANCE_PLATFORM, jobName);
    logger.warn({ platform: MAINTENANCE_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: MAINTENANCE_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
