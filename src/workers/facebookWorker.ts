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
import { logQueued, logRunning, logSuccess, logFailure, logStalled } from '../db/repositories/syncLogRepo';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { config } from '../config';

if (!config.FACEBOOK_ENABLED) {
  logger.warn({ platform: FACEBOOK_PLATFORM }, 'facebook disabled — worker not started');
} else {
const facebookWorker = new Worker(
  FACEBOOK_QUEUE,
  async (job) => {
    const startedAt = Date.now();
    logger.info({ platform: FACEBOOK_PLATFORM, jobName: job.name }, 'job started');

    let syncLog: { id: bigint } | null = null;
    try {
      const queuedId = await logQueued(FACEBOOK_PLATFORM, job.name);
      syncLog = await logRunning(queuedId);
      const syncedAt = new Date();

      switch (job.name) {
        case FACEBOOK_JOBS.CAMPAIGNS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchCampaigns(last, async (page) => {
            const rows = page.map((r) => transformCampaign(r, syncedAt));
            recordsSaved += await upsertCampaigns(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updated_time) continue;
              const d = new Date(r.updated_time);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSETS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchAdsets(last, async (page) => {
            const rows = page.map((r) => transformAdset(r, syncedAt));
            recordsSaved += await upsertAdsets(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updated_time) continue;
              const d = new Date(r.updated_time);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          let recordsFetched = 0;
          let recordsSaved = 0;
          let latestModified: Date | null = null;

          await fetchAds(last, async (page) => {
            const rows = page.map((r) => transformAd(r, syncedAt));
            recordsSaved += await upsertAds(rows);
            recordsFetched += page.length;
            for (const r of page) {
              if (!r.updated_time) continue;
              const d = new Date(r.updated_time);
              if (latestModified === null || d > latestModified) latestModified = d;
            }
          });

          await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, latestModified ?? syncedAt);
          await logSuccess(syncLog.id, { recordsFetched, recordsSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.CAMPAIGN_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          if (!last && !config.FACEBOOK_HISTORICAL_START_DATE) {
            logger.warn({ platform: FACEBOOK_PLATFORM }, 'FACEBOOK_HISTORICAL_START_DATE not set — defaulting to 90 days; set this env var to sync full history');
          }
          const endDate = getYesterdayDate();
          const startDate = last ? last.toISOString().split('T')[0] : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchCampaignInsights(date);
            const rows  = raw.map((r) => transformCampaignInsight(r, syncedAt));
            const saved = await upsertCampaignInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
            await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, new Date(date + 'T00:00:00.000Z'));
          }
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.ADSET_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          if (!last && !config.FACEBOOK_HISTORICAL_START_DATE) {
            logger.warn({ platform: FACEBOOK_PLATFORM }, 'FACEBOOK_HISTORICAL_START_DATE not set — defaulting to 90 days; set this env var to sync full history');
          }
          const endDate = getYesterdayDate();
          const startDate = last ? last.toISOString().split('T')[0] : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchAdsetInsights(date);
            const rows  = raw.map((r) => transformAdsetInsight(r, syncedAt));
            const saved = await upsertAdsetInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
            await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, new Date(date + 'T00:00:00.000Z'));
          }
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        case FACEBOOK_JOBS.AD_INSIGHTS: {
          const last = await getLastSyncedAt(FACEBOOK_PLATFORM, job.name);
          if (!last && !config.FACEBOOK_HISTORICAL_START_DATE) {
            logger.warn({ platform: FACEBOOK_PLATFORM }, 'FACEBOOK_HISTORICAL_START_DATE not set — defaulting to 90 days; set this env var to sync full history');
          }
          const endDate = getYesterdayDate();
          const startDate = last ? last.toISOString().split('T')[0] : getHistoricalStartDate();
          const dates = getDateRange(startDate, endDate);
          let totalFetched = 0;
          let totalSaved = 0;
          for (const date of dates) {
            const raw   = await fetchAdInsights(date);
            const rows  = raw.map((r) => transformAdInsight(r, syncedAt));
            const saved = await upsertAdInsights(rows);
            totalFetched += raw.length;
            totalSaved   += saved;
            await setLastSyncedAt(FACEBOOK_PLATFORM, job.name, new Date(date + 'T00:00:00.000Z'));
          }
          await logSuccess(syncLog.id, { recordsFetched: totalFetched, recordsSaved: totalSaved, recordsSkipped: 0, durationMs: Date.now() - startedAt });
          break;
        }

        default:
          throw new Error(`facebookWorker: unknown job name: ${job.name}`);
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
    concurrency: 1,
    lockDuration: 3600000, // 60 min — insight backfills across many dates exceed the 30s default on first run
    limiter: { max: 5, duration: 1000 },
  },
);

facebookWorker.on('stalled', async (jobId: string, jobName: string) => {
  try {
    await logStalled(FACEBOOK_PLATFORM, jobName);
    logger.warn({ platform: FACEBOOK_PLATFORM, jobId, jobName }, 'stalled job marked failed in sync_logs');
  } catch (err) {
    logger.error({ platform: FACEBOOK_PLATFORM, jobId, err }, 'failed to update sync_log for stalled job');
  }
});
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getHistoricalStartDate(): string {
  if (config.FACEBOOK_HISTORICAL_START_DATE) {
    return config.FACEBOOK_HISTORICAL_START_DATE;
  }
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
