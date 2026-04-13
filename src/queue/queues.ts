import { Queue } from 'bullmq';
import { connection } from './connection';
import { CIN7_QUEUE } from '../constants/cin7';
import { SHOPIFY_QUEUE } from '../constants/shopify';
import { GA4_QUEUE } from '../constants/ga4';
import { FACEBOOK_QUEUE } from '../constants/facebook';
import { KLAVIYO_QUEUE } from '../constants/klaviyo';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const cin7Queue     = new Queue(CIN7_QUEUE,     { connection, defaultJobOptions });
export const shopifyQueue  = new Queue(SHOPIFY_QUEUE,  { connection, defaultJobOptions });
export const ga4Queue      = new Queue(GA4_QUEUE,      { connection, defaultJobOptions });
export const facebookQueue = new Queue(FACEBOOK_QUEUE, { connection, defaultJobOptions });
export const klaviyoQueue  = new Queue(KLAVIYO_QUEUE,  { connection, defaultJobOptions });
