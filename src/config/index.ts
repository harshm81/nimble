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

  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_AD_ACCOUNT_ID: z.string().optional(),

  KLAVIYO_API_KEY: z.string().optional(),
  KLAVIYO_CONVERSION_METRIC_ID: z.string().optional(),
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
