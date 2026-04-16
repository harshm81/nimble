import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().min(1).transform(Number),
  NODE_ENV: z.string().min(1),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  LOG_LEVEL: z.string().min(1),

  BULL_BOARD_USERNAME: z.string().min(1),
  BULL_BOARD_PASSWORD: z.string().min(1),

  CIN7_API_USERNAME: z.string().optional(),
  CIN7_API_KEY: z.string().optional(),

  SHOPIFY_SHOP_NAME: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),

  GA4_PROPERTY_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GA4_HISTORICAL_START_DATE: z.string().optional(),

  FACEBOOK_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_AD_ACCOUNT_ID: z.string().optional(),

  KLAVIYO_API_KEY: z.string().optional(),
  KLAVIYO_CONVERSION_METRIC_ID: z.string().optional(),
  KLAVIYO_SYNC_EVENT_TYPES: z.string().optional(),

  CIN7_ENABLED:     z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  SHOPIFY_ENABLED:  z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  GA4_ENABLED:      z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  FACEBOOK_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  KLAVIYO_ENABLED:  z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // logger is not available yet — config validation runs before logger is initialised
  process.stderr.write(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}\n`,
  );
  process.exit(1);
}

export const config = parsed.data;

if (config.GA4_ENABLED && !config.GA4_PROPERTY_ID) {
  process.stderr.write('GA4_ENABLED=true but GA4_PROPERTY_ID is not set\n');
  process.exit(1);
}
if (config.GA4_ENABLED && !config.GOOGLE_SERVICE_ACCOUNT_JSON) {
  process.stderr.write('GA4_ENABLED=true but GOOGLE_SERVICE_ACCOUNT_JSON is not set\n');
  process.exit(1);
}
if (config.KLAVIYO_ENABLED && !config.KLAVIYO_API_KEY) {
  process.stderr.write('KLAVIYO_ENABLED=true but KLAVIYO_API_KEY is not set\n');
  process.exit(1);
}
if (config.SHOPIFY_ENABLED && !config.SHOPIFY_SHOP_NAME) {
  process.stderr.write('SHOPIFY_ENABLED=true but SHOPIFY_SHOP_NAME is not set\n');
  process.exit(1);
}
if (config.CIN7_ENABLED && !config.CIN7_API_USERNAME) {
  process.stderr.write('CIN7_ENABLED=true but CIN7_API_USERNAME is not set\n');
  process.exit(1);
}
if (config.CIN7_ENABLED && !config.CIN7_API_KEY) {
  process.stderr.write('CIN7_ENABLED=true but CIN7_API_KEY is not set\n');
  process.exit(1);
}
if (config.FACEBOOK_ENABLED && !config.FACEBOOK_ACCESS_TOKEN) {
  process.stderr.write('FACEBOOK_ENABLED=true but FACEBOOK_ACCESS_TOKEN is not set\n');
  process.exit(1);
}
if (config.FACEBOOK_ENABLED && !config.FACEBOOK_AD_ACCOUNT_ID) {
  process.stderr.write('FACEBOOK_ENABLED=true but FACEBOOK_AD_ACCOUNT_ID is not set\n');
  process.exit(1);
}
