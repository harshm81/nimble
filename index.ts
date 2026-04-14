import { config } from './src/config';
import { checkTokenExpiry } from './src/auth/tokenManager';
import prisma from './src/db/prismaClient';
import { connection } from './src/queue/connection';
import { registerSchedulers } from './src/queue/scheduler';
import './src/workers/cin7Worker';
import './src/workers/shopifyWorker';
import './src/workers/klaviyoWorker';
import './src/workers/ga4Worker';
import app from './src/server/app';
import { logger } from './src/utils/logger';

async function start() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connected');

  await connection.ping();
  logger.info('Redis connected');

  await registerSchedulers();
  logger.info('Schedulers registered');

  await checkTokenExpiry();

  const server = app.listen(config.PORT, () => {
    logger.info(`Nimble started — all queues registered [port=${config.PORT}, env=${config.NODE_ENV}]`);
  });

  async function shutdown() {
    logger.info('Shutting down...');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 30_000);
      server.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await prisma.$disconnect();
    await connection.quit();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.error(err, 'Startup failed');
  process.exit(1);
});
