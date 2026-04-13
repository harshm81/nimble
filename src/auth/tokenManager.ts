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
      const token = await getOrRefreshToken(SHOPIFY_PLATFORM);
      return { 'X-Shopify-Access-Token': token };
    }

    case FACEBOOK_PLATFORM: {
      const token = await getOrRefreshToken(FACEBOOK_PLATFORM);
      return { access_token: token };
    }
  }
}

// GA4 excluded — auth handled entirely by googleapis SDK

async function getOrRefreshToken(platform: typeof SHOPIFY_PLATFORM | typeof FACEBOOK_PLATFORM): Promise<string> {
  const row = await prisma.platformToken.findUnique({ where: { platform } });

  if (!row) {
    throw new Error(`No token found for ${platform} — run initial token setup`);
  }

  const expiringWithin5Min =
    row.expires_at && row.expires_at < new Date(Date.now() + 5 * 60_000);

  if (expiringWithin5Min) {
    return platform === SHOPIFY_PLATFORM
      ? refreshShopifyToken()
      : refreshFacebookToken(row.access_token);
  }

  return row.access_token;
}

async function refreshShopifyToken(): Promise<string> {
  const response = await axios.post(
    `https://${config.SHOPIFY_SHOP_NAME}.myshopify.com/admin/oauth/access_token`,
    {
      client_id: config.SHOPIFY_CLIENT_ID,
      client_secret: config.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }
  );

  const { access_token, expires_in } = response.data as {
    access_token: string;
    expires_in: number;
  };

  await prisma.platformToken.upsert({
    where: { platform: SHOPIFY_PLATFORM },
    create: {
      platform: SHOPIFY_PLATFORM,
      access_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
    },
    update: {
      access_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
    },
  });

  logger.info({ platform: SHOPIFY_PLATFORM, msg: 'Access token refreshed' });
  return access_token;
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
      access_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
    },
    update: {
      access_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
    },
  });

  logger.info({ platform: FACEBOOK_PLATFORM, msg: 'Access token refreshed' });
  return access_token;
}

export async function checkTokenExpiry(): Promise<void> {
  const row = await prisma.platformToken.findUnique({
    where: { platform: FACEBOOK_PLATFORM },
  });

  if (!row || !row.expires_at) return;

  const daysLeft =
    (row.expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 14) {
    logger.warn({
      platform: FACEBOOK_PLATFORM,
      daysLeft: Math.floor(daysLeft),
      msg: 'Facebook token expiring soon — refresh will be attempted automatically',
    });
  }
}
