# Nimble API

A multi-platform data sync service built with Node.js + TypeScript. Pulls data from external platforms (Cin7, Shopify, GA4, Facebook, Klaviyo) into a MariaDB data warehouse via scheduled BullMQ workers.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (strict) |
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
| GA4 | Planned | — |
| Facebook | Planned | — |
| Klaviyo | Planned | — |

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
  auth/            # Platform token management and refresh
  types/           # TypeScript interfaces for raw API responses
  constants/       # Per-platform string constants (platform, queue, job names, base URL)
  config/          # Environment config with Zod validation
  utils/           # logger, chunk, sleep
prisma/
  schema.prisma    # Database schema
  migrations/      # Migration history
index.ts           # Entry point
```

## Prerequisites

- Node.js 20+
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

   # Shopify
   SHOPIFY_SHOP_NAME=
   SHOPIFY_CLIENT_ID=
   SHOPIFY_CLIENT_SECRET=
   SHOPIFY_WEBHOOK_SECRET=

   # GA4 (planned)
   GA4_PROPERTY_ID=
   GOOGLE_SERVICE_ACCOUNT_JSON=

   # Facebook (planned)
   FACEBOOK_APP_ID=
   FACEBOOK_APP_SECRET=
   FACEBOOK_AD_ACCOUNT_ID=

   # Klaviyo (planned)
   KLAVIYO_API_KEY=
   KLAVIYO_CONVERSION_METRIC_ID=
   ```

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

## Docker

A `Dockerfile` is included. The service expects `db` and `redis` service names resolvable within the same Docker network:

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

## Adding a New Platform

Follow the mandatory step order in [`.claude/rules/platform-integration.md`](.claude/rules/platform-integration.md):

1. Constants → 2. API Types → 3. Schema + Migration → 4. Repo Interfaces → 5. Transformers → 6. Adapters → 7. Repository upserts → 8. Worker → 9. Scheduler
