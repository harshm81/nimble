---
description: Logging standards — apply when adding log statements or creating new workers/adapters
paths: ["src/**"]
---

# Logging Rules

## Import

Always use: `import { logger } from '../utils/logger'` (adjust relative path as needed)
Never use: `console.log`, `console.error`, `console.warn`

## Levels

| Level | When | Example |
|---|---|---|
| `error` | Unrecoverable failures, exceptions caught in worker catch block | `logger.error({ err, platform, jobName }, 'Job failed')` |
| `warn` | Recoverable issues — rate limit hit, retry triggered, missing optional data | `logger.warn({ platform, retryAfter }, 'Rate limited, backing off')` |
| `info` | Job lifecycle events, page fetched, records upserted | `logger.info({ platform, jobName, recordCount }, 'Upsert complete')` |
| `debug` | Detailed per-record data, full API responses (disabled in production) | `logger.debug({ record }, 'Transformed record')` |

## Structured Fields

Always include context fields — never rely on message strings alone for filtering.

| Layer | Required fields |
|---|---|
| Workers | `{ platform, jobName }` on every log line |
| Adapters | `{ platform, resource, page }` (page number or cursor) |
| Repositories | `{ platform, resource, recordCount }` |

## Anti-Patterns

- Never log inside a per-record loop at `info` level — use `debug` or log a summary after the batch
- Never log sensitive data (tokens, API keys, customer emails) at any level
- Never use string interpolation for structured data — pass objects to pino:

```ts
// CORRECT
logger.info({ platform: 'cin7', records: 500 }, 'Upsert complete');

// WRONG
logger.info(`Upserted 500 records for cin7`);
```

## Sync Logging Functions

Workers must use the sync log functions from `syncLogRepo.ts` for job lifecycle:
- `logQueued(platform, jobName)` — before the try block
- `logRunning(syncLogId)` — inside the try block, before work begins
- `logSuccess(syncLogId, { recordsFetched, recordsSaved })` — after successful upsert
- `logFailure(syncLogId, errorMessage)` — in the catch block
