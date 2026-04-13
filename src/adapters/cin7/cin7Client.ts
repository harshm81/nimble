import axios, { InternalAxiosRequestConfig } from 'axios';
import { config } from '../../config';
import { CIN7_PLATFORM, CIN7_BASE_URL } from '../../constants/cin7';
import { logger } from '../../utils/logger';

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

cin7Client.interceptors.response.use(
  (response) => {
    const config = response.config as InternalAxiosRequestConfig & {
      metadata: { startTime: number };
    };
    const duration = Date.now() - config.metadata.startTime;

    logger.info({
      platform: CIN7_PLATFORM,
      status: response.status,
      duration,
    });

    return response;
  },
  (error) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { metadata: { startTime: number } })
      | undefined;
    const duration = config?.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : undefined;

    logger.error({
      platform: CIN7_PLATFORM,
      status: error.response?.status,
      duration,
    });

    return Promise.reject(error);
  },
);
