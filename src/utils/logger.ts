import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['password', 'apiKey', 'accessToken', 'authorization'],
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
    },
  }),
});
