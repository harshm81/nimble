# Constants Rules

## Location

One file per platform under `src/constants/`:

```
src/constants/
  cin7.ts
  shopify.ts
  ga4.ts
  facebook.ts
  klaviyo.ts
```

## What Belongs Here

| Constant | Example |
|---|---|
| Platform identifier string | `CIN7_PLATFORM = 'cin7'` |
| Queue name | `CIN7_QUEUE = 'cin7'` |
| Base API URL | `CIN7_BASE_URL = 'https://api.cin7.com/api'` |
| Job name map | `CIN7_JOBS = { ORDERS: 'cin7:orders', ... } as const` |

## What Does NOT Belong Here

- Status strings (`'running'`, `'queued'`, `'success'`) — stay in `syncLogRepo.ts`
- HTTP status codes — stay in the adapter layer
- Cron patterns — stay in `scheduler.ts` (schedules change independently)
- Error messages — use structured log fields, not string constants

## Rules

- Always `as const` on object maps — enables type narrowing in `switch` statements
- Never use inline string literals for platform names, queue names, or job names anywhere in the codebase — always import from the relevant constants file
- When adding a new job to a platform, add it to `*_JOBS` in the constants file first, then use the constant in both the worker and scheduler
- When adding a new platform, create a new `src/constants/<platform>.ts` file following the same shape

## Usage Pattern

```ts
// Worker
import { CIN7_PLATFORM, CIN7_QUEUE, CIN7_JOBS } from '../constants/cin7';

new Worker(CIN7_QUEUE, async (job) => {
  await logQueued(CIN7_PLATFORM, job.name);
  switch (job.name) {
    case CIN7_JOBS.ORDERS: { ... }
  }
});

// Scheduler
import { CIN7_JOBS } from '../constants/cin7';
cin7Queue.add(CIN7_JOBS.ORDERS, {}, { repeat: { pattern: '*/30 * * * *' } });
```
