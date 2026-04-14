import { Worker } from 'bullmq';
import { connection } from '../queue/connection';
import { FACEBOOK_PLATFORM, FACEBOOK_QUEUE, FACEBOOK_JOBS } from '../constants/facebook';

import { fetchCampaigns }        from '../adapters/facebook/campaigns';
import { fetchAdsets }           from '../adapters/facebook/adsets';
import { fetchAds }              from '../adapters/facebook/ads';
import { fetchCampaignInsights } from '../adapters/facebook/campaignInsights';
import { fetchAdsetInsights }    from '../adapters/facebook/adsetInsights';
import { fetchAdInsights }       from '../adapters/facebook/adInsights';

import { transformCampaign }        from '../transform/facebook/campaignTransformer';
import { transformAdset }           from '../transform/facebook/adsetTransformer';
import { transformAd }              from '../transform/facebook/adTransformer';
import { transformCampaignInsight } from '../transform/facebook/campaignInsightTransformer';
import { transformAdsetInsight }    from '../transform/facebook/adsetInsightTransformer';
import { transformAdInsight }       from '../transform/facebook/adInsightTransformer';

import {
  upsertCampaigns,
  upsertAdsets,
  upsertAds,
  upsertCampaignInsights,
  upsertAdsetInsights,
  upsertAdInsights,
} from '../db/repositories/facebookRepo';

import { getLastSyncedAt, setLastSyncedAt } from '../db/repositories/syncConfigRepo';
import { logQueued, logRunning, logSuccess, logFailure } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';

export const facebookWorker = new Worker(
  FACEBOOK_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: FACEBOOK_PLATFORM, job: job.name }, 'job started');

    const queuedId = await logQueued(FACEBOOK_PLATFORM, job.name);
    const syncLog  = await logRunning(queuedId);

    try {
      const syncedAt = new Date();

      switch (job.name) {
        case FACEBOOK_JOBS.CAMPAIGNS: {
          const last  = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw   = await fetchCampaigns(last);
          const rows  = raw.map((r) => transformCampaign(r, syncedAt));
          const saved = await upsertCampaigns(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSETS: {
          const last  = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw   = await fetchAdsets(last);
          const rows  = raw.map((r) => transformAdset(r, syncedAt));
          const saved = await upsertAdsets(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADS: {
          const last  = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw   = await fetchAds(last);
          const rows  = raw.map((r) => transformAd(r, syncedAt));
          const saved = await upsertAds(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.CAMPAIGN_INSIGHTS: {
          const date  = getYesterdayDate();
          const raw   = await fetchCampaignInsights(date);
          const rows  = raw.map((r) => transformCampaignInsight(r, syncedAt));
          const saved = await upsertCampaignInsights(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSET_INSIGHTS: {
          const date  = getYesterdayDate();
          const raw   = await fetchAdsetInsights(date);
          const rows  = raw.map((r) => transformAdsetInsight(r, syncedAt));
          const saved = await upsertAdsetInsights(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.AD_INSIGHTS: {
          const date  = getYesterdayDate();
          const raw   = await fetchAdInsights(date);
          const rows  = raw.map((r) => transformAdInsight(r, syncedAt));
          const saved = await upsertAdInsights(rows);

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logFailure(syncLog.id, { errorMessage: message, durationMs: Date.now() - startedAt });
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: { max: 5, duration: 1000 },
  },
);

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
