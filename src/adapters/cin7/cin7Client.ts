import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { config } from '../../config';
import { CIN7_PLATFORM, CIN7_BASE_URL } from '../../constants/cin7';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/sleep';

const encoded = Buffer.from(
  `${config.CIN7_API_USERNAME ?? ''}:${config.CIN7_API_KEY ?? ''}`
).toString('base64');

export const cin7Client = axios.create({
  baseURL: CIN7_BASE_URL,
  headers: {
    Authorization: `Basic ${encoded}`,
  },
});

cin7Client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  (config as InternalAxiosRequestConfig & { metadata: { startTime: number } }).metadata = {
    startTime: Date.now(),
  };

  logger.info({
    platform: CIN7_PLATFORM,
    method: config.method?.toUpperCase(),
    url: config.url,
  });

  return config;
});

const MAX_RETRIES = 3;

cin7Client.interceptors.response.use(
  (response) => {
    const cfg = response.config as InternalAxiosRequestConfig & {
      metadata: { startTime: number };
    };
    const duration = Date.now() - cfg.metadata.startTime;

    logger.info({
      platform: CIN7_PLATFORM,
      status: response.status,
      duration,
    });

    return response;
  },
  async (error: AxiosError) => {
    const cfg = error.config as
      | (InternalAxiosRequestConfig & { metadata: { startTime: number }; _retryCount?: number })
      | undefined;
    const duration = cfg?.metadata?.startTime
      ? Date.now() - cfg.metadata.startTime
      : undefined;

    if (error.response?.status === 429 && cfg) {
      const retryCount = cfg._retryCount ?? 0;
      if (retryCount < MAX_RETRIES) {
        cfg._retryCount = retryCount + 1;
        const retryAfter = error.response.headers['retry-after'];
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000 * Math.pow(2, retryCount);

        logger.warn({
          platform: CIN7_PLATFORM,
          status: 429,
          retryCount: cfg._retryCount,
          delayMs,
          duration,
        }, 'Rate limited, backing off');

        await sleep(delayMs);
        return cin7Client.request(cfg);
      }
    }

    logger.error({
      platform: CIN7_PLATFORM,
      status: error.response?.status,
      duration,
    });

    return Promise.reject(error);
  },
);
