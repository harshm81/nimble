# Nimble API

A multi-platform data sync service built with Node.js + TypeScript. Pulls data from external platforms (Cin7, Shopify, GA4, Facebook, Klaviyo) into a MariaDB data warehouse via scheduled BullMQ workers.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + TypeScript (strict) |
| Database | MariaDB via Prisma ORM (MariaDB adapter) |
| Queue | BullMQ (Redis-backed) |
| Web server | Express v5 |
| Logging | pino / pino-pretty |
| Validation | Zod |

## Supported Platforms

| Platform | Status | Jobs |
|---|---|---|
| Cin7 | Active | orders, contacts, products, inventory, purchase orders, credit notes, stock adjustments, branches |
| Shopify | Active | orders, customers, products, product variants, inventory |
| GA4 | Active | daily sessions, ecommerce events, product data |
| Facebook | Active | campaigns, adsets, ads, campaign insights, adset insights, ad insights |
| Klaviyo | Active | campaigns, campaign stats, profiles, events, flows |

## Sync Schedule

| Platform | Job | Schedule |
|---|---|---|
| Cin7 | orders | every 30 min |
| Cin7 | contacts | every 1 hr |
| Cin7 | products | every 1 hr |
| Cin7 | inventory | daily 1:00 AM |
| Cin7 | purchase orders | every 1 hr |
| Cin7 | credit notes | every 1 hr |
| Cin7 | stock adjustments | every 1 hr |
| Cin7 | branches | daily 2:00 AM |
| Shopify | orders | every 15 min |
| Shopify | customers | every 1 hr |
| Shopify | products | every 1 hr |
| Shopify | inventory / product variants | triggered by products job |
| GA4 | daily report | daily 3:00 AM |
| Facebook | campaigns | daily 4:00 AM |
| Facebook | adsets | daily 4:05 AM |
| Facebook | ads | daily 4:10 AM |
| Facebook | campaign insights | daily 4:15 AM |
| Facebook | adset insights | daily 4:20 AM |
| Facebook | ad insights | daily 4:25 AM |
| Klaviyo | campaigns | daily 5:00 AM |
| Klaviyo | campaign stats | daily 5:30 AM |
| Klaviyo | flows | daily 5:05 AM |
| Klaviyo | profiles | every 6 hrs |
| Klaviyo | events | every 1 hr |
| Maintenance | daily summary | daily 1:00 AM |

## Project Structure

```
src/
  adapters/        # External API clients — fetch only, no transforms
  transform/       # Pure data mapping — no DB, no API calls
  db/
    repositories/  # DB upsert/query via Prisma.$executeRaw
  workers/         # BullMQ job processors
  queue/           # Queue definitions and cron scheduler
  server/          # Express app, health checks, Bull Board, webhooks
  types/           # TypeScript interfaces for raw API responses
  constants/       # Per-platform string constants (platform, queue, job names, base URL)
  config/          # Environment config with Zod validation
  scripts/         # One-off seed and test data scripts
  utils/           # logger, chunk, sleep, extractErrorMessage
prisma/
  schema.prisma    # Database schema
  migrations/      # Migration history
index.ts           # Entry point
```

## Prerequisites

- Node.js 22+
- MariaDB / MySQL
- Redis

## Getting Started

1. **Clone and install**

   ```bash
   git clone https://github.com/harshm81/nimble.git
   cd nimble
   npm install
   ```

2. **Configure environment**

   Copy the example below to `.env` and fill in your values:

   ```env
   PORT=3000
   NODE_ENV=development

   DATABASE_URL=mysql://user:password@localhost:3306/nimble
   REDIS_URL=redis://localhost:6379

   LOG_LEVEL=info

   BULL_BOARD_USERNAME=admin
   BULL_BOARD_PASSWORD=admin

   # Cin7
   CIN7_API_USERNAME=
   CIN7_API_KEY=
   CIN7_ENABLED=true

   # Shopify
   SHOPIFY_SHOP_NAME=
   SHOPIFY_CLIENT_ID=
   SHOPIFY_CLIENT_SECRET=
   SHOPIFY_WEBHOOK_SECRET=
   SHOPIFY_ENABLED=true

   # GA4
   GA4_PROPERTY_ID=
   GOOGLE_SERVICE_ACCOUNT_JSON=
   GA4_HISTORICAL_START_DATE=2024-01-01
   GA4_ENABLED=true

   # Facebook
   FACEBOOK_ACCESS_TOKEN=
   FACEBOOK_APP_ID=
   FACEBOOK_APP_SECRET=
   FACEBOOK_AD_ACCOUNT_ID=
   FACEBOOK_HISTORICAL_START_DATE=2024-01-01
   FACEBOOK_ENABLED=true

   # Klaviyo
   KLAVIYO_API_KEY=
   KLAVIYO_CONVERSION_METRIC_ID=
   KLAVIYO_SYNC_EVENT_TYPES=
   KLAVIYO_ENABLED=true
   ```

   Each platform can be toggled off independently via its `*_ENABLED` flag without removing credentials.

3. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with live reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:reset` | Reset database and re-run all migrations |
| `npm test` | Run all tests (jest) |
| `npm run test:unit` | Run transformer unit tests only (`src/transform`) |
| `npm run test:integration` | Run pipeline integration tests (`src/workers`) |

## Docker

A `Dockerfile` is included (Node 22 Alpine). The service expects `db` and `redis` service names resolvable within the same Docker network:

```env
DATABASE_URL=mysql://root:root@db:3306/nimble
REDIS_URL=redis://redis:6379
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/health/ready` | Readiness check (DB + Redis) |
| GET | `/admin/queues` | Bull Board queue UI (auth required) |
| POST | `/webhooks/shopify/cart` | Shopify cart event webhook |

## Architecture

Each platform follows a strict layered pipeline:

```
Scheduler (cron)
  → BullMQ Worker
    → Adapter (fetch raw API data)
      → Transformer (map to DB input type)
        → Repository (batch upsert via raw SQL)
```

Sync state is tracked in `sync_log` (job history) and `sync_config` (last synced cursor per job).

All upserts use `ON DUPLICATE KEY UPDATE` — retries are safe by default. Incremental syncs use `lastSyncedAt` from `sync_config`; first run fetches full history.

## Adding a New Platform

Follow the mandatory step order in [`.claude/rules/platform-integration.md`](.claude/rules/platform-integration.md):

1. Constants → 2. API Types → 3. Schema + Migration → 4. Repo Interfaces → 5. Transformers → 6. Adapters → 7. Repository upserts → 8. Worker → 9. Scheduler
