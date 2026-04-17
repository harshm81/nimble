import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { KLAVIYO_PLATFORM, KLAVIYO_QUEUE, KLAVIYO_JOBS } from '../constants/klaviyo';
import { fetchCampaigns } from '../adapters/klaviyo/campaigns';
import { fetchCampaignStats } from '../adapters/klaviyo/campaignStats';
import { fetchProfiles } from '../adapters/klaviyo/profiles';
import { fetchEvents } from '../adapters/klaviyo/events';
import { fetchFlows } from '../adapters/klaviyo/flows';
import { transformCampaign } from '../transform/klaviyo/campaignTransformer';
import { transformCampaignStat } from '../transform/klaviyo/campaignStatTransformer';
import { transformProfile } from '../transform/klaviyo/profileTransformer';
import { transformEvent } from '../transform/klaviyo/eventTransformer';
import { transformFlow } from '../transform/klaviyo/flowTransformer';
import {
  getAllKlaviyoCampaignIds,
  getOldestKlaviyoCampaignSendTime,
  upsertCampaigns,
  upsertCampaignStats,
  upsertProfiles,
  upsertEvents,
  upsertFlows,
} from '../db/repositories/klaviyoRepo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { config } from '../config';

if (!config.KLAVIYO_ENABLED) {
  logger.warn({ platform: KLAVIYO_PLATFORM }, 'klaviyo disabled — worker not started');
} else {
const klaviyoWorker = new Worker(
  KLAVIYO_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: KLAVIYO_PLATFORM, job: job.name }, 'job started');
    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(KLAVIYO_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      const lastSyncedAt = await getLastSyncedAt(KLAVIYO_PLATFORM, job.name);
      const syncedAt = new Date();

      switch (job.name) {
        case KLAVIYO_JOBS.CAMPAIGNS: {
          logger.debug(
            { platform: KLAVIYO_PLATFORM, job: job.name, lastSyncedAt },
            'starting campaigns fetch',
          );

          let recordsFetched = 0;
          let campaignsSaved = 0;
          let latestModified: Date | null = null;

          // Incremental upsert — only campaigns modified since last run
          await fetchCampaigns(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformCampaign(r, syncedAt));
            campaignsSaved += await upsertCampaigns(rows);
            recordsFetched += page.length;
            for (const r of page) {
              const ts = r.attributes.updated_at;
              if (!ts) continue;
              const d = new Date(ts);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved: campaignsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.CAMPAIGN_STATS: {
          // Read all campaign IDs from DB — no extra Klaviyo API call, no rate limit risk.
          // Stats (opens, clicks) accumulate on old campaigns even when the campaign record
          // itself hasn't changed, so we always fetch stats for every campaign ever synced.
          const allCampaignIds = await getAllKlaviyoCampaignIds();

          // campaign-values-reports enforces a hard 1-year maximum on the timeframe.
          // Start from the oldest campaign send_time so all campaigns are included,
          // but cap at 1 year ago to stay within Klaviyo's limit.
          const now = syncedAt.toISOString();
          const oneYearAgo = new Date(syncedAt);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const oldestSendTime = await getOldestKlaviyoCampaignSendTime();
          const statsStart = oldestSendTime && oldestSendTime > oneYearAgo ? oldestSendTime : oneYearAgo;

          let statsSaved = 0;

          // Upsert per batch — stats appear in DB after each 100-campaign batch (~35s apart).
          // If the job fails mid-way, already-upserted batches persist and retry re-upserts
          // them safely via ON DUPLICATE KEY UPDATE.
          await fetchCampaignStats(allCampaignIds, statsStart.toISOString(), now, async (batch) => {
            const rows = batch.map((r) => transformCampaignStat(r, syncedAt)).filter((r): r is NonNullable<typeof r> => r !== null);
            statsSaved += await upsertCampaignStats(rows);
          });

          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: allCampaignIds.length,
            recordsSaved: statsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.PROFILES: {
          let recordsFetched = 0;
          let recordsSaved   = 0;
          let latestModified: Date | null = null;

          await fetchProfiles(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformProfile(r, syncedAt));
            const saved = await upsertProfiles(rows);
            recordsFetched += page.length;
            recordsSaved   += saved;
            for (const r of page) {
              const ts = r.attributes.updated;
              if (!ts) continue;
              const d = new Date(ts);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.EVENTS: {
          // Events are filtered by datetime, not updatedAt — use syncedAt as cursor
          let recordsFetched = 0;
          let recordsSaved   = 0;

          await fetchEvents(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformEvent(r, syncedAt));
            const saved = await upsertEvents(rows);
            recordsFetched += page.length;
            recordsSaved   += saved;
          });

          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.FLOWS: {
          let recordsFetched = 0;
          let recordsSaved   = 0;
          let latestModified: Date | null = null;

          await fetchFlows(lastSyncedAt, async (page) => {
            const rows = page.map((r) => transformFlow(r, syncedAt));
            recordsSaved   += await upsertFlows(rows);
            recordsFetched += page.length;
            for (const r of page) {
              const ts = r.attributes.updated;
              if (!ts) continue;
              const d = new Date(ts);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        default:
          throw new Error(`klaviyoWorker: unknown job name: ${job.name}`);
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
    concurrency: 1,    // campaign-values-reports is 2 req/min — never run two Klaviyo jobs in parallel
    lockDuration: 3600000, // 60 min — profiles/events fetch large datasets that exceed the old 10 min lock
    limiter: { max: 3, duration: 1000 },
  },
);

klaviyoWorker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(KLAVIYO_PLATFORM, jobName);
    logger.warn({ platform: KLAVIYO_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: KLAVIYO_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
}
