import axios, { InternalAxiosRequestConfig } from 'axios';
import { config } from '../../config';
import { SHOPIFY_PLATFORM, SHOPIFY_BASE_URL } from '../../constants/shopify';
import { getAuthHeaders } from '../../auth/tokenManager';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

function parseCallLimit(header: string): { used: number; limit: number } {
  const [used, limit] = header.split('/').map(Number);
  return { used, limit };
}

async function checkAndRespectRateLimit(headers: Record<string, string>): Promise<void> {
  const header = headers['x-shopify-shop-api-call-limit'];
  if (!header) return;

  const { used, limit } = parseCallLimit(header);
  const remaining = limit - used;

  if (remaining < 200) {
    logger.warn({ platform: SHOPIFY_PLATFORM, remaining }, 'rate limit low, sleeping');
    await sleep(10_000);
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
    (error) => {
      const cfg = error.config as
        | (InternalAxiosRequestConfig & { metadata: { startTime: number } })
        | undefined;
      const duration = cfg?.metadata?.startTime ? Date.now() - cfg.metadata.startTime : undefined;
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

  await checkAndRespectRateLimit(response.headers as Record<string, string>);

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

  await checkAndRespectRateLimit(response.headers as Record<string, string>);

  return {
    data: response.data.data as T,
    headers: response.headers as Record<string, string>,
  };
}
