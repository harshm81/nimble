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
  upsertCampaigns,
  upsertCampaignStats,
  upsertProfiles,
  upsertEvents,
  upsertFlows,
} from '../db/repositories/klaviyoRepo';
import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

export const klaviyoWorker = new Worker(
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
          const rawCampaigns = await fetchCampaigns(lastSyncedAt);
          const campaigns = rawCampaigns.map((r) => transformCampaign(r, syncedAt));

          const campaignIds = rawCampaigns.map((r) => r.id);
          const now = syncedAt.toISOString();
          const statsStart = lastSyncedAt ?? (() => { const d = new Date(syncedAt); d.setDate(d.getDate() - 90); return d; })();
          const rawStats = await fetchCampaignStats(campaignIds, statsStart.toISOString(), now);
          const campaignStats = rawStats.map((r) => transformCampaignStat(r, syncedAt));

          const campaignsSaved = await upsertCampaigns(campaigns);
          const statsSaved = await upsertCampaignStats(campaignStats);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: rawCampaigns.length,
            recordsSaved: campaignsSaved + statsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.PROFILES: {
          const raw = await fetchProfiles(lastSyncedAt);
          const rows = raw.map((r) => transformProfile(r, syncedAt));
          const recordsSaved = await upsertProfiles(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.EVENTS: {
          const raw = await fetchEvents(lastSyncedAt);
          const rows = raw.map((r) => transformEvent(r, syncedAt));
          const recordsSaved = await upsertEvents(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
            recordsSaved,
            recordsSkipped: 0,
            durationMs: Date.now() - startedAt,
          });
          break;
        }

        case KLAVIYO_JOBS.FLOWS: {
          const raw = await fetchFlows(lastSyncedAt);
          const rows = raw.map((r) => transformFlow(r, syncedAt));
          const recordsSaved = await upsertFlows(rows);
          await setLastSyncedAt(KLAVIYO_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, {
            recordsFetched: raw.length,
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
    concurrency: 1, // campaign-values-reports is 2 req/min — never run two Klaviyo jobs in parallel
    limiter: { max: 3, duration: 1000 },
  },
);
