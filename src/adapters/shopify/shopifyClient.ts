import axios, { InternalAxiosRequestConfig } from 'axios';
import { config } from '../../config';
import { SHOPIFY_PLATFORM, SHOPIFY_BASE_URL } from '../../constants/shopify';
import { getAuthHeaders } from '../../auth/tokenManager';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

// Shopify GraphQL uses a cost-based leaky bucket (100 points/s on standard plans).
// The REST header x-shopify-shop-api-call-limit is NOT sent on GraphQL responses.
// Instead, throttle status is returned in the response body under extensions.cost.throttleStatus.
async function checkAndRespectRateLimit(
  body: { extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; maximumAvailable: number } } } },
): Promise<void> {
  const throttle = body.extensions?.cost?.throttleStatus;
  if (!throttle) return;

  const { currentlyAvailable, maximumAvailable } = throttle;
  // Sleep when bucket is below 20% to avoid hitting the limit mid-pagination
  if (currentlyAvailable < maximumAvailable * 0.2) {
    const waitMs = Math.ceil(((maximumAvailable * 0.5 - currentlyAvailable) / 100) * 1000);
    logger.warn({ platform: SHOPIFY_PLATFORM, currentlyAvailable, maximumAvailable, waitMs }, 'GraphQL bucket low — throttling');
    await sleep(waitMs);
  }
}

export async function createShopifyClient() {
  const headers = await getAuthHeaders(SHOPIFY_PLATFORM);

  const client = axios.create({
    baseURL: SHOPIFY_BASE_URL(config.SHOPIFY_SHOP_NAME ?? ''),
    headers,
  });

  client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
    (cfg as InternalAxiosRequestConfig & { metadata: { startTime: number } }).metadata = {
      startTime: Date.now(),
    };
    logger.info({ platform: SHOPIFY_PLATFORM, method: cfg.method?.toUpperCase(), url: cfg.url });
    return cfg;
  });

  client.interceptors.response.use(
    (res) => {
      const cfg = res.config as InternalAxiosRequestConfig & { metadata: { startTime: number } };
      const duration = Date.now() - cfg.metadata.startTime;
      logger.info({ platform: SHOPIFY_PLATFORM, status: res.status, duration });
      return res;
    },
    async (error) => {
      const cfg = error.config as
        | (InternalAxiosRequestConfig & { metadata: { startTime: number }; __retryCount?: number })
        | undefined;
      const duration = cfg?.metadata?.startTime ? Date.now() - cfg.metadata.startTime : undefined;

      if (error.response?.status === 429 && cfg) {
        const retryCount = cfg.__retryCount ?? 0;
        if (retryCount < 3) {
          const retryAfter = parseInt(error.response.headers?.['retry-after'] ?? '10', 10);
          logger.warn({ platform: SHOPIFY_PLATFORM, retryAfter, retryCount: retryCount + 1 }, 'Shopify 429 — retrying');
          cfg.__retryCount = retryCount + 1;
          await sleep(retryAfter * 1000);
          return client.request(cfg);
        }
      }

      if (error.response?.status === 401) {
        logger.error({ platform: SHOPIFY_PLATFORM, status: 401, duration }, 'shopify 401 — token may need refresh');
      } else {
        logger.error({ platform: SHOPIFY_PLATFORM, status: error.response?.status, duration });
      }
      throw error;
    },
  );

  return client;
}

export async function executeQuery<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data: T; headers: Record<string, string> }> {
  // Client created once per call — avoids a DB token lookup on every pagination page.
  // Adapters call executeQuery per page, passing the same client implicitly via closure.
  const client = await createShopifyClient();

  const response = await client.post('', { query, variables });

  await checkAndRespectRateLimit(response.data);

  return {
    data: response.data.data as T,
    headers: response.headers as Record<string, string>,
  };
}

export async function executeQueryWithClient<T>(
  client: Awaited<ReturnType<typeof createShopifyClient>>,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data: T; headers: Record<string, string> }> {
  const response = await client.post('', { query, variables });

  await checkAndRespectRateLimit(response.data);

  return {
    data: response.data.data as T,
    headers: response.headers as Record<string, string>,
  };
}
