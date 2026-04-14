---
description: Naming conventions for all source files — apply when creating or editing TypeScript files
paths: ["src/**"]
---

# Naming Conventions

## Database

| Thing | Convention | Example |
|---|---|---|
| Table names | `snake_case` | `cin7_orders` |
| Column names | `snake_case` | `order_number`, `synced_at` |

## Prisma Schema

| Thing | Convention | Example |
|---|---|---|
| Model names | `PascalCase` | `Cin7Order` |
| Field names | `camelCase` | `orderNumber` |
| Table mapping | `@@map("snake_case")` | `@@map("cin7_orders")` |
| Column mapping | `@map("snake_case")` | `@map("order_number")` |

## TypeScript

| Thing | Convention | Example |
|---|---|---|
| Interfaces | `PascalCase` prefixed | `Cin7SalesOrder` |
| Functions | `camelCase` | `fetchOrders`, `transformOrder` |
| Files | `camelCase` | `cin7Client.ts`, `orderTransformer.ts` |
| Constants | `camelCase` | `cin7Client` |
| Env vars | `UPPER_SNAKE_CASE` | `CIN7_API_KEY` |

## Function Naming by Layer

| Layer | Prefix | Example |
|---|---|---|
| Adapters (fetch) | `fetch` | `fetchOrders()` |
| Transformers | `transform` | `transformOrder()` |
| Repositories | `upsert` / `get` / `find` | `upsertOrders()` |
| Workers | `process` / `run` | `processSync()` |

## Timestamp Column Naming — All Tables

| Column | Meaning | Auto? |
|---|---|---|
| `src_created_at` | When the **source platform** created the record | No — mapped from API field |
| `src_modified_at` | When the **source platform** last modified the record — **incremental sync key** | No — mapped from API field |
| `created_at` | When **we** inserted the row | Yes — `DEFAULT CURRENT_TIMESTAMP(3)` |
| `modified_at` | When **we** last upserted the row | Yes — `ON UPDATE CURRENT_TIMESTAMP(3)` |

- `src_created_at` / `src_modified_at` are only added when the source API exposes them
- Analytics tables (GA4, Facebook Insights) omit `src_*` columns entirely
- In Prisma schema: `srcCreatedAt`, `srcModifiedAt`, `createdAt`, `modifiedAt` (camelCase)
- Always index `src_modified_at` — it is used as the incremental sync key

## File Naming

| Layer | Convention | Example |
|---|---|---|
| Constants | `<platform>.ts` (lowercase) | `cin7.ts`, `shopify.ts` |
| Types | `<platform>.types.ts` | `cin7.types.ts` |
| Transformers | `<resource>Transformer.ts` (camelCase) | `orderTransformer.ts` |
| Adapters | `<resource>.ts` (camelCase) | `orders.ts`, `products.ts` |
| API clients | `<platform>Client.ts` (camelCase) | `cin7Client.ts` |
| Repositories | `<platform>Repo.ts` (camelCase) | `cin7Repo.ts` |
| Workers | `<platform>Worker.ts` (camelCase) | `cin7Worker.ts` |

## Types — Nullable Fields
- Always use `Type | null` — never `Type | undefined` for API response fields
- Always use `?? null` for nullable assignments in transformers
