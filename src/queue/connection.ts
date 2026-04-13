import IORedis from 'ioredis';
import { config } from '../config';

const { hostname, port } = new URL(config.REDIS_URL);

export const connection = new IORedis({
  host: hostname,
  port: Number(port),
  maxRetriesPerRequest: null,
});
