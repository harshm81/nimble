import { cin7Queue, shopifyQueue } from './queues';
import { CIN7_JOBS } from '../constants/cin7';
import { SHOPIFY_JOBS } from '../constants/shopify';

export async function registerSchedulers(): Promise<void> {
  await Promise.all([
    // Cin7
    cin7Queue.add(CIN7_JOBS.ORDERS,            {}, { repeat: { pattern: '*/30 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.CONTACTS,          {}, { repeat: { pattern: '0 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.PRODUCTS,          {}, { repeat: { pattern: '5 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.INVENTORY,         {}, { repeat: { pattern: '0 1 * * *' } }),
    cin7Queue.add(CIN7_JOBS.PURCHASE_ORDERS,   {}, { repeat: { pattern: '10 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.CREDIT_NOTES,      {}, { repeat: { pattern: '15 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.STOCK_ADJUSTMENTS, {}, { repeat: { pattern: '20 * * * *' } }),
    cin7Queue.add(CIN7_JOBS.BRANCHES,          {}, { repeat: { pattern: '0 2 * * *' } }),

    // Shopify
    shopifyQueue.add(SHOPIFY_JOBS.ORDERS,   {}, { repeat: { pattern: '*/15 * * * *' } }),
    shopifyQueue.add(SHOPIFY_JOBS.CUSTOMERS,{}, { repeat: { pattern: '25 * * * *' } }),
    shopifyQueue.add(SHOPIFY_JOBS.PRODUCTS, {}, { repeat: { pattern: '30 * * * *' } }),
    // INVENTORY and PRODUCT_VARIANTS are not cron-scheduled — enqueued by the products job after completion

    // GA4 — worker not yet implemented
    // ga4Queue.add(GA4_JOBS.DAILY, {}, { repeat: { pattern: '0 3 * * *' } }),

    // Facebook — worker not yet implemented
    // facebookQueue.add(FACEBOOK_JOBS.DAILY, {}, { repeat: { pattern: '0 4 * * *' } }),

    // Klaviyo — worker not yet implemented
    // klaviyoQueue.add(KLAVIYO_JOBS.CAMPAIGNS, {}, { repeat: { pattern: '0 5 * * *' } }),
    // klaviyoQueue.add(KLAVIYO_JOBS.PROFILES,  {}, { repeat: { pattern: '0 */6 * * *' } }),
    // klaviyoQueue.add(KLAVIYO_JOBS.EVENTS,    {}, { repeat: { pattern: '40 * * * *' } }),
    // klaviyoQueue.add(KLAVIYO_JOBS.FLOWS,     {}, { repeat: { pattern: '5 5 * * *' } }),
  ]);
}
