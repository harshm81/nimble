import express, { Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from '../config';
import prisma from '../db/prismaClient';
import { connection } from '../queue/connection';
import {
  cin7Queue,
  shopifyQueue,
  ga4Queue,
  facebookQueue,
  klaviyoQueue,
} from '../queue/queues';
import { shopifyCartWebhookRouter } from './webhooks/shopifyCartWebhook';

const app = express();

// Capture raw body for webhook HMAC verification before any body parsers run
app.use((req: Request, _res: Response, next: NextFunction) => {
  let data = Buffer.alloc(0);
  req.on('data', (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
  req.on('end', () => {
    (req as Request & { rawBody: Buffer }).rawBody = data;
    next();
  });
});

// Webhook routes — must be mounted before express.json() to preserve raw body
app.use(shopifyCartWebhookRouter);

// Health — liveness
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Health — readiness
app.get('/health/ready', async (_req: Request, res: Response) => {
  const checks = { database: 'ok', redis: 'ok' };
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  try {
    await connection.ping();
  } catch {
    checks.redis = 'error';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'error', checks });
});

// Bull Board — basic auth
function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Unauthorized');
    return;
  }

  const [username, password] = Buffer.from(header.slice(6), 'base64').toString().split(':');

  if (username !== config.BULL_BOARD_USERNAME || password !== config.BULL_BOARD_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }

  next();
}

// Bull Board — setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(cin7Queue),
    new BullMQAdapter(shopifyQueue),
    new BullMQAdapter(ga4Queue),
    new BullMQAdapter(facebookQueue),
    new BullMQAdapter(klaviyoQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', basicAuth, serverAdapter.getRouter());

export default app;
