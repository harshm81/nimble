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
import { config } from '../config';

if (!config.FACEBOOK_ENABLED) {
  logger.warn({ platform: FACEBOOK_PLATFORM }, 'facebook disabled — worker not started');
} else {
new Worker(
  FACEBOOK_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: FACEBOOK_PLATFORM, jobName: job.name }, 'job started');

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
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updated_time) return max;
            const d = new Date(r.updated_time);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSETS: {
          const last  = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw   = await fetchAdsets(last);
          const rows  = raw.map((r) => transformAdset(r, syncedAt));
          const saved = await upsertAdsets(rows);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updated_time) return max;
            const d = new Date(r.updated_time);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADS: {
          const last  = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const raw   = await fetchAds(last);
          const rows  = raw.map((r) => transformAd(r, syncedAt));
          const saved = await upsertAds(rows);
          const latestModified = raw.reduce<Date | null>((max, r) => {
            if (!r.updated_time) return max;
            const d = new Date(r.updated_time);
            return max === null || d > max ? d : max;
          }, null);
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: raw.length, recordsSaved: saved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.CAMPAIGN_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const endDate = getYesterdayDate();
          const startDate = last
            ? last.toISOString().split('T')[0]
            : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchCampaignInsights(date);
            const rows  = raw.map((r) => transformCampaignInsight(r, syncedAt));
            const saved = await upsertCampaignInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
          }
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSET_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const endDate = getYesterdayDate();
          const startDate = last
            ? last.toISOString().split('T')[0]
            : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchAdsetInsights(date);
            const rows  = raw.map((r) => transformAdsetInsight(r, syncedAt));
            const saved = await upsertAdsetInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
          }
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.AD_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          const endDate = getYesterdayDate();
          const startDate = last
            ? last.toISOString().split('T')[0]
            : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchAdInsights(date);
            const rows  = raw.map((r) => transformAdInsight(r, syncedAt));
            const saved = await upsertAdInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
          }
          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, syncedAt);
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        default:
          throw new Error(`facebookWorker: unknown job name: ${job.name}`);
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
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getHistoricalStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
