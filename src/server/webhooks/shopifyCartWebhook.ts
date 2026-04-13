import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { SHOPIFY_PLATFORM } from '../../constants/shopify';
import { ShopifyCartWebhookPayload } from '../../types/shopify.types';
import { upsertCartEvent } from '../../db/repositories/shopifyRepo';

export const shopifyCartWebhookRouter = Router();

// Shopify sends the raw body HMAC-SHA256 signed with the webhook secret.
// Express must expose the raw body — this route must be mounted BEFORE express.json().
shopifyCartWebhookRouter.post(
  '/webhooks/shopify/cart',
  async (req: Request, res: Response): Promise<void> => {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string | undefined;
    const topic = req.headers['x-shopify-topic'] as string | undefined;
    const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);

    // Verify HMAC signature when secret is configured.
    // Skipped in development so the endpoint can be tested locally via Postman
    // without needing to compute a matching signature.
    if (config.SHOPIFY_WEBHOOK_SECRET && config.NODE_ENV !== 'development') {
      if (!hmacHeader) {
        res.status(401).json({ error: 'Missing HMAC header' });
        return;
      }

      const expected = crypto
        .createHmac('sha256', config.SHOPIFY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('base64');

      if (!crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(expected))) {
        logger.warn({ platform: SHOPIFY_PLATFORM, topic }, 'shopify webhook HMAC verification failed');
        res.status(401).json({ error: 'Invalid HMAC signature' });
        return;
      }
    }

    // Determine event type from topic header (carts/create or carts/update)
    const eventType = topic === 'carts/create' ? 'create' : 'update';

    let payload: ShopifyCartWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as ShopifyCartWebhookPayload;
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const syncedAt = new Date();

    try {
      await upsertCartEvent({
        shopifyCartId: payload.token ?? payload.id,
        eventType,
        customerEmail: payload.email ?? payload.customer?.email ?? null,
        customerId: payload.customer?.id != null ? String(payload.customer.id) : null,
        lineItemsCount: payload.line_items?.length ?? null,
        totalPrice: payload.total_price !== null && payload.total_price !== undefined
          ? parseFloat(payload.total_price)
          : null,
        currency: payload.currency ?? null,
        srcCreatedAt: new Date(payload.created_at),
        srcModifiedAt: new Date(payload.updated_at),
        rawData: payload,
        syncedAt,
      });

      logger.info({ platform: SHOPIFY_PLATFORM, topic, cartId: payload.token ?? payload.id }, 'cart event saved');
      res.status(200).json({ received: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ platform: SHOPIFY_PLATFORM, topic, error: errorMessage }, 'failed to save cart event');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
