import axios from 'axios';
import { config } from '../config';
import prisma from '../db/prismaClient';
import { logger } from '../utils/logger';
import { CIN7_PLATFORM } from '../constants/cin7';
import { SHOPIFY_PLATFORM } from '../constants/shopify';
import { FACEBOOK_PLATFORM } from '../constants/facebook';
import { KLAVIYO_PLATFORM } from '../constants/klaviyo';

export async function getAuthHeaders(
  platform: typeof CIN7_PLATFORM | typeof SHOPIFY_PLATFORM | typeof KLAVIYO_PLATFORM | typeof FACEBOOK_PLATFORM
): Promise<Record<string, string>> {
  switch (platform) {
    case CIN7_PLATFORM: {
      const token = Buffer.from(
        `${config.CIN7_API_USERNAME}:${config.CIN7_API_KEY}`
      ).toString('base64');
      return { Authorization: `Basic ${token}` };
    }

    case KLAVIYO_PLATFORM: {
      return {
        Authorization: `Klaviyo-API-Key ${config.KLAVIYO_API_KEY}`,
        revision: '2026-01-15',
        'Content-Type': 'application/json',
      };
    }

    case SHOPIFY_PLATFORM: {
      // Shopify custom app offline access tokens are permanent — no refresh needed.
      // Token is obtained once via OAuth code exchange (POST /admin/oauth/access_token)
      // and stored in platform_tokens. Seed it by hitting GET /auth/shopify/setup.
      const row = await prisma.platformToken.findUnique({ where: { platform: SHOPIFY_PLATFORM } });
      if (!row) {
        throw new Error(
          'No Shopify token found in platform_tokens — seed it once: POST /auth/shopify/token { "token": "shpat_..." }'
        );
      }
      return { 'X-Shopify-Access-Token': row.accessToken };
    }

    case FACEBOOK_PLATFORM: {
      const token = await getOrRefreshFacebookToken();
      return { access_token: token };
    }
  }
}

// GA4 excluded — auth handled entirely by googleapis SDK

async function getOrRefreshFacebookToken(): Promise<string> {
  const row = await prisma.platformToken.findUnique({ where: { platform: FACEBOOK_PLATFORM } });

  if (!row) {
    throw new Error(`No token found for ${FACEBOOK_PLATFORM} — run initial token setup`);
  }

  const expiringWithin5Min =
    row.expiresAt && row.expiresAt < new Date(Date.now() + 5 * 60_000);

  if (expiringWithin5Min) {
    return refreshFacebookToken(row.accessToken);
  }

  return row.accessToken;
}

async function refreshFacebookToken(currentToken: string): Promise<string> {
  const response = await axios.get(
    'https://graph.facebook.com/v25.0/oauth/access_token',
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.FACEBOOK_APP_ID,
        client_secret: config.FACEBOOK_APP_SECRET,
        fb_exchange_token: currentToken,
        set_token_expires_in_60_days: true,
      },
    }
  );

  const { access_token, expires_in } = response.data as {
    access_token: string;
    expires_in: number;
  };

  await prisma.platformToken.upsert({
    where: { platform: FACEBOOK_PLATFORM },
    create: {
      platform: FACEBOOK_PLATFORM,
      accessToken: access_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
    },
    update: {
      accessToken: access_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
    },
  });

  logger.info({ platform: FACEBOOK_PLATFORM, msg: 'Access token refreshed' });
  return access_token;
}

export async function checkTokenExpiry(): Promise<void> {
  const row = await prisma.platformToken.findUnique({
    where: { platform: FACEBOOK_PLATFORM },
  });

  if (!row || !row.expiresAt) return;

  const daysLeft =
    (row.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 14) {
    logger.warn({
      platform: FACEBOOK_PLATFORM,
      daysLeft: Math.floor(daysLeft),
      msg: 'Facebook token expiring soon — refresh will be attempted automatically',
    });
  }
}
