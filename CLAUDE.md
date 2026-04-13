# Nimble API — Claude Instructions

## Project

- **Stack:** Node.js + TypeScript, Prisma (MariaDB adapter), MySQL, BullMQ, pino
- **Root:** `/var/www/html/Nimble/nimble-api`
- **NEVER** create files outside this root

## Critical Rules

- All DB tables and columns: `snake_case`
- All Prisma model names: `PascalCase` with `@@map` + `@map` on every field
- Never write raw SQL outside Prisma migrations
- Never modify `_prisma_migrations` manually
- Prisma Client import: `import prisma from '../db/prismaClient'` (default export)
- Logger import: `import { logger } from '../utils/logger'` — never use `console.log`
- No `any` types — strict TypeScript only

## Folder Layout

```
src/
  adapters/        # External API clients (fetch logic only)
  transform/       # Pure data mapping (no DB calls)
  db/repositories/ # DB upsert/query functions (raw SQL via Prisma.$executeRaw)
  workers/         # BullMQ job processors
  queue/           # Queue definitions and scheduler
  types/           # TypeScript interfaces
  constants/       # Per-platform string constants (platform name, queue, job names, base URL)
  utils/           # Shared helpers (logger, chunk, sleep)
  config/          # Environment config
```

## See Also

- `.claude/rules/prisma.md` — Prisma workflow and migration rules
- `.claude/rules/naming.md` — Naming conventions
- `.claude/rules/datatypes.md` — Data type standards (money, strings, timestamps, etc.)
- `.claude/rules/project-structure.md` — File and folder standards
- `.claude/rules/constants.md` — Platform constants (job names, queue names, base URLs)
- `.claude/rules/platform-integration.md` — Mandatory step order when adding a new platform
