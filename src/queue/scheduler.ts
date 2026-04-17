import { cin7Queue, shopifyQueue, ga4Queue, facebookQueue, klaviyoQueue, maintenanceQueue } from './queues';
import { CIN7_JOBS } from '../constants/cin7';
import { SHOPIFY_JOBS } from '../constants/shopify';
import { GA4_JOBS } from '../constants/ga4';
import { FACEBOOK_JOBS } from '../constants/facebook';
import { KLAVIYO_JOBS } from '../constants/klaviyo';
import { MAINTENANCE_JOBS } from '../constants/maintenance';
import { config } from '../config';

export async function registerSchedulers(): Promise<void> {
  const jobs: Promise<unknown>[] = [];

  if (config.CIN7_ENABLED) {
    jobs.push(
      cin7Queue.add(CIN7_JOBS.ORDERS,            {}, { repeat: { pattern: '*/30 * * * *' }, jobId: CIN7_JOBS.ORDERS }),
      cin7Queue.add(CIN7_JOBS.CONTACTS,          {}, { repeat: { pattern: '0 * * * *' },    jobId: CIN7_JOBS.CONTACTS }),
      cin7Queue.add(CIN7_JOBS.PRODUCTS,          {}, { repeat: { pattern: '5 * * * *' },    jobId: CIN7_JOBS.PRODUCTS }),
      cin7Queue.add(CIN7_JOBS.INVENTORY,         {}, { repeat: { pattern: '0 1 * * *' },    jobId: CIN7_JOBS.INVENTORY }),
      cin7Queue.add(CIN7_JOBS.PURCHASE_ORDERS,   {}, { repeat: { pattern: '10 * * * *' },   jobId: CIN7_JOBS.PURCHASE_ORDERS }),
      cin7Queue.add(CIN7_JOBS.CREDIT_NOTES,      {}, { repeat: { pattern: '15 * * * *' },   jobId: CIN7_JOBS.CREDIT_NOTES }),
      cin7Queue.add(CIN7_JOBS.STOCK_ADJUSTMENTS, {}, { repeat: { pattern: '20 * * * *' },   jobId: CIN7_JOBS.STOCK_ADJUSTMENTS }),
      cin7Queue.add(CIN7_JOBS.BRANCHES,          {}, { repeat: { pattern: '0 2 * * *' },    jobId: CIN7_JOBS.BRANCHES }),
    );
  }

  if (config.SHOPIFY_ENABLED) {
    jobs.push(
      shopifyQueue.add(SHOPIFY_JOBS.ORDERS,    {}, { repeat: { pattern: '*/15 * * * *' }, jobId: SHOPIFY_JOBS.ORDERS }),
      shopifyQueue.add(SHOPIFY_JOBS.CUSTOMERS, {}, { repeat: { pattern: '25 * * * *' },   jobId: SHOPIFY_JOBS.CUSTOMERS }),
      shopifyQueue.add(SHOPIFY_JOBS.PRODUCTS,  {}, { repeat: { pattern: '30 * * * *' },   jobId: SHOPIFY_JOBS.PRODUCTS }),
      // INVENTORY and PRODUCT_VARIANTS are not cron-scheduled — enqueued by the products job after completion
    );
  }

  if (config.GA4_ENABLED) {
    jobs.push(
      ga4Queue.add(GA4_JOBS.DAILY, {}, { repeat: { pattern: '0 3 * * *' }, jobId: GA4_JOBS.DAILY }),
    );
  }

  if (config.FACEBOOK_ENABLED) {
    // Staggered 5 min apart to avoid concurrent API storms
    jobs.push(
      facebookQueue.add(FACEBOOK_JOBS.CAMPAIGNS,         {}, { repeat: { pattern: '0 4 * * *' },  jobId: FACEBOOK_JOBS.CAMPAIGNS }),
      facebookQueue.add(FACEBOOK_JOBS.ADSETS,            {}, { repeat: { pattern: '5 4 * * *' },  jobId: FACEBOOK_JOBS.ADSETS }),
      facebookQueue.add(FACEBOOK_JOBS.ADS,               {}, { repeat: { pattern: '10 4 * * *' }, jobId: FACEBOOK_JOBS.ADS }),
      facebookQueue.add(FACEBOOK_JOBS.CAMPAIGN_INSIGHTS, {}, { repeat: { pattern: '15 4 * * *' }, jobId: FACEBOOK_JOBS.CAMPAIGN_INSIGHTS }),
      facebookQueue.add(FACEBOOK_JOBS.ADSET_INSIGHTS,    {}, { repeat: { pattern: '20 4 * * *' }, jobId: FACEBOOK_JOBS.ADSET_INSIGHTS }),
      facebookQueue.add(FACEBOOK_JOBS.AD_INSIGHTS,       {}, { repeat: { pattern: '25 4 * * *' }, jobId: FACEBOOK_JOBS.AD_INSIGHTS }),
    );
  }

  if (config.KLAVIYO_ENABLED) {
    jobs.push(
      klaviyoQueue.add(KLAVIYO_JOBS.FLOWS,           {}, { repeat: { pattern: '5 5 * * *' },   jobId: KLAVIYO_JOBS.FLOWS }),
      klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGNS,       {}, { repeat: { pattern: '0 5 * * *' },   jobId: KLAVIYO_JOBS.CAMPAIGNS }),
      klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGN_STATS,  {}, { repeat: { pattern: '30 5 * * *' },  jobId: KLAVIYO_JOBS.CAMPAIGN_STATS }),
      klaviyoQueue.add(KLAVIYO_JOBS.PROFILES,        {}, { repeat: { pattern: '0 */6 * * *' }, jobId: KLAVIYO_JOBS.PROFILES }),
      klaviyoQueue.add(KLAVIYO_JOBS.EVENTS,          {}, { repeat: { pattern: '40 * * * *' },  jobId: KLAVIYO_JOBS.EVENTS }),
    );
  }

  // Maintenance — always registered
  jobs.push(
    maintenanceQueue.add(MAINTENANCE_JOBS.DAILY_SUMMARY, {}, {
      repeat: { pattern: '0 1 * * *' },
      jobId: MAINTENANCE_JOBS.DAILY_SUMMARY,
    }),
    // Disabled: sync logs are kept indefinitely for debugging. Uncomment to re-enable 90-day cleanup.
    // maintenanceQueue.add(MAINTENANCE_JOBS.CLEANUP_LOGS, {}, {
    //   repeat: { pattern: '30 1 * * *' },
    //   jobId: MAINTENANCE_JOBS.CLEANUP_LOGS,
    // }),
  );

  await Promise.all(jobs);
}
