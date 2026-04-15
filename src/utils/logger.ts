import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: [
    'password',
    'apiKey',
    'accessToken',
    'authorization',
    'access_token',
    '*.accessToken',
    '*.access_token',
    '*.authorization',
    'req.headers.authorization',
    'req.headers["x-shopify-access-token"]',
  ],
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
    },
  }),
});
