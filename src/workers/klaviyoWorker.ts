import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { klaviyoQueue } from '../queue/queues';
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
  upsertCampaigns,
  upsertCampaignStats,
  upsertProfiles,
  upsertEvents,
  upsertFlows,
} from '../db/repositories/klaviyoRepo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { config } from '../config';

if (!config.KLAVIYO_ENABLED) {
  logger.warn({ platform: KLAVIYO_PLATFORM }, 'klaviyo disabled — worker not started');
} else {
new Worker(
  KLAVIYO_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: KLAVIYO_PLATFORM, job: job.name }, 'job started');
    const queuedId = await logQueued(KLAVIYO_PLATFORM, job.name);
    const syncLog = await logRunning(queuedId);

    try {
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

          // Trigger child job after logSuccess — enqueues stats independently so a stats
          // failure does not force campaigns to re-fetch
          await klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGN_STATS, {}, {
            jobId: `${KLAVIYO_JOBS.CAMPAIGN_STATS}:${Date.now()}`,
          });
          break;
        }

        case KLAVIYO_JOBS.CAMPAIGN_STATS: {
          // Read all campaign IDs from DB — no extra Klaviyo API call, no rate limit risk.
          // Stats (opens, clicks) accumulate on old campaigns even when the campaign record
          // itself hasn't changed, so we always fetch stats for every campaign ever synced.
          const allCampaignIds = await getAllKlaviyoCampaignIds();

          // Fixed 90-day lookback — not lastSyncedAt — because stats accumulate over time
          // and must be re-fetched on every run to stay current.
          const now = syncedAt.toISOString();
          const statsStart = new Date(syncedAt);
          statsStart.setUTCDate(statsStart.getUTCDate() - 90);

          let statsSaved = 0;

          // Upsert per batch — stats appear in DB after each 100-campaign batch (~35s apart).
          // If the job fails mid-way, already-upserted batches persist and retry re-upserts
          // them safely via ON DUPLICATE KEY UPDATE.
          await fetchCampaignStats(allCampaignIds, statsStart.toISOString(), now, async (batch) => {
            const rows = batch.map((r) => transformCampaignStat(r, syncedAt));
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
    concurrency: 1,    // campaign-values-reports is 2 req/min — never run two Klaviyo jobs in parallel
    lockDuration: 600000, // 10 min — campaign-stats sleeps 35s between batches, exceeds default 30s lock
    limiter: { max: 3, duration: 1000 },
  },
);
}
