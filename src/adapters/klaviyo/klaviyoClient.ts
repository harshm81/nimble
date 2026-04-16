import axios from 'axios';
import { config } from '../../config';
import { KLAVIYO_BASE_URL, KLAVIYO_API_REVISION, KLAVIYO_PLATFORM } from '../../constants/klaviyo';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

export const klaviyoClient = axios.create({
  baseURL: KLAVIYO_BASE_URL,
  headers: {
    Authorization: `Klaviyo-API-Key ${config.KLAVIYO_API_KEY}`,
    revision: KLAVIYO_API_REVISION,
    'Content-Type': 'application/json',
  },
  // Axios v1.x default serializer converts `page[size]` → `page_size`, which Klaviyo rejects.
  // URLSearchParams preserves bracket notation verbatim: page[size]=50
  // Axios v1.x requires { serialize: fn } — a bare function is silently ignored.
  paramsSerializer: {
    serialize: (params: Record<string, unknown>) => new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString(),
  },
});

klaviyoClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const status = error.response?.status;

    if (status === 429) {
      const cfg = error.config as unknown as Record<string, unknown>;
      const retryCount = typeof cfg.__retryCount === 'number' ? cfg.__retryCount : 0;

      if (retryCount >= 3) {
        throw error;
      }

      const retryAfter = parseInt(error.response?.headers?.['retry-after'] ?? '5', 10);

      logger.warn(
        { platform: KLAVIYO_PLATFORM, retryAfter },
        '429 received — retrying',
      );

      cfg.__retryCount = retryCount + 1;
      await sleep(retryAfter * 1000);

      return klaviyoClient.request(error.config!);
    }

    if (status === 401) {
      logger.error(
        { platform: KLAVIYO_PLATFORM, status: 401 },
        'Klaviyo auth failed — check KLAVIYO_API_KEY',
      );
    }

    // Log the full Klaviyo error response body so root cause is visible in logs
    logger.error(
      {
        platform: KLAVIYO_PLATFORM,
        status,
        url: error.config?.url,
        params: error.config?.params,
        responseBody: error.response?.data,
      },
      'Klaviyo API error',
    );

    throw error;
  },
);
