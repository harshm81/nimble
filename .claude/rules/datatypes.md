---
description: Data type standards — apply when creating or editing Prisma schema, TypeScript types, or repository files
paths: ["prisma/**", "src/types/**", "src/db/**", "src/transform/**"]
---

# Data Type Standards

Every data category has one canonical type. Never deviate — consistency prevents rounding errors,
truncation bugs, and type mismatches between layers.

## Type Mapping by Layer

| Layer | Tool | Role |
|---|---|---|
| API response | TypeScript interface (`src/types/`) | Mirrors exact API shape |
| Transformer | TypeScript (`src/transform/`) | Converts API types → DB-ready types |
| Repository input | TypeScript interface | Passed to `$executeRaw` |
| Database | MySQL via Prisma schema | `@db.*` annotations |

---

## 1. Primary Keys (Surrogate)

| Layer | Type | Notes |
|---|---|---|
| Prisma | `BigInt @id @default(autoincrement()) @db.UnsignedBigInt` | All surrogate PKs |
| MySQL | `BIGINT UNSIGNED AUTO_INCREMENT` | |
| TypeScript | Not exposed — internal only | Never return raw `BigInt` in API responses |

**Exception:** Tables with a natural unique key (e.g. `platform_tokens.platform`) omit the surrogate `id`.

---

## 2. External Platform IDs

IDs differ per platform — use the correct type for each:

| Platform | API type | Prisma | MySQL | TypeScript |
|---|---|---|---|---|
| Cin7 | Integer | `Int` | `INT` | `number` |
| Shopify (REST) | Integer | `Int` | `INT` | `number` |
| Klaviyo | Alphanumeric string (e.g. `"01H5QQV9F57XJHJDMD86RX4QM5"`) | `String @db.VarChar(50)` | `VARCHAR(50)` | `string` |
| Facebook | Numeric string (e.g. `"6042147342661"`) | `String @db.VarChar(50)` | `VARCHAR(50)` | `string` |
| GA4 | No record IDs | — | — | — |

**Rule:** Never store a Klaviyo or Facebook ID in an `INT` column — they are strings even when they look numeric.

---

## 3. Money / Prices / Amounts

**Never use `Float` or `Double` for money** — floating-point arithmetic causes rounding errors (`0.1 + 0.2 !== 0.3`). `DECIMAL` stores exact values.

Platform API formats differ — always normalise in the transformer before storing:

| Platform | API format | Example | Transformer action |
|---|---|---|---|
| Cin7 | `number` | `255.92` | direct → store as Decimal |
| Shopify | `string` | `"255.92"` | `parseFloat(value)` → store as Decimal |
| Klaviyo | `number` | `9.99` | direct → store as Decimal |
| Facebook | `number` (spend/budget) | `2352.45` | direct → store as Decimal |
| GA4 | `string` | `"12900"` | `parseFloat(value)` → store as Decimal |

**Precision by field type** (verified against Cin7 API docs):

| Field type | Prisma | MySQL | Notes |
|---|---|---|---|
| Order/invoice totals, tax, shipping amounts | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12, 2)` | 2dp — final rounded values |
| Unit prices, cost prices (product/inventory) | `Decimal @db.Decimal(12, 4)` | `DECIMAL(12, 4)` | 4dp — Cin7 stores prices with up to 4dp |
| Line item unit price | `Decimal @db.Decimal(12, 4)` | `DECIMAL(12, 4)` | 4dp — intermediate calc uses 7dp internally |
| Line item tax, line item total | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12, 2)` | 2dp — final rounded amounts |
| Credit limit | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12, 2)` | 2dp — currency amount |

---

## 4. Quantities / Stock Levels

Covers: `qty`, `stock_on_hand`, `available`, `committed`, `incoming`, `reorder_point`, `reorder_qty`

| Layer | Type | Notes |
|---|---|---|
| Prisma | `Decimal @db.Decimal(12, 4)` | 4dp for fractional units (e.g. `1.5000` kg) |
| MySQL | `DECIMAL(12, 4)` | |
| TypeScript (API) | `number` | All platforms return quantities as numbers |

---

## 5. Rates / Percentages

| Data | Prisma | MySQL | Notes |
|---|---|---|---|
| Exchange rates | `Decimal @db.Decimal(12, 6)` | `DECIMAL(12, 6)` | 6dp (e.g. `0.684521`) |
| Line item discount % | `Decimal @db.Decimal(8, 2)` | `DECIMAL(8, 2)` | Cin7: % value 0–100, 2dp (e.g. `10.50`) |
| Contact discount % | `Decimal @db.Decimal(8, 4)` | `DECIMAL(8, 4)` | Contact-level discount, 4dp |

---

## 6. Dimensions / Weights / Physical Measurements

Covers: `weight`, `cbm`, `height`, `width`, `depth`

| Layer | Type | Notes |
|---|---|---|
| Prisma | `Decimal? @db.Decimal(10, 4)` | Nullable — not always present |
| MySQL | `DECIMAL(10, 4)` | |
| TypeScript (API) | `number \| null` | |

---

## 7. Ad / Analytics Metrics (Facebook Insights, GA4)

Facebook Insights and GA4 return metrics inconsistently — always store as `DECIMAL` after parsing:

| Platform | Metric type | API format | Example | Transformer action |
|---|---|---|---|---|
| Facebook | Spend/budget | `number` | `2352.45` | direct |
| Facebook | Impressions/clicks | `string` | `"9708"` | `parseInt(value)` |
| Facebook | Cost per action | `string` | `"0.24"` | `parseFloat(value)` |
| GA4 | All metrics | `string` | `"2541"` | parse per `metricType` header |
| GA4 | Currency metrics | `string` | `"12900"` | `parseFloat(value)` |
| GA4 | Count metrics | `string` | `"2541"` | `parseInt(value)` |

| Data | Prisma | MySQL |
|---|---|---|
| Integer metrics (sessions, clicks, impressions) | `Int` | `INT` |
| Currency metrics (spend, revenue) | `Decimal @db.Decimal(12, 2)` | `DECIMAL(12, 2)` |
| Rate metrics (CTR, conversion rate) | `Decimal @db.Decimal(8, 4)` | `DECIMAL(8, 4)` |

**GA4 rule:** Always check the `metricType` header (`TYPE_INTEGER`, `TYPE_FLOAT`, `TYPE_CURRENCY`) to decide which parse function to use in the transformer.

---

## 8. Strings — by Length Category

Always size VARCHAR to actual content. Never use Prisma's bare `String` — it defaults to `VARCHAR(191)` (a Prisma legacy artifact).

| Category | Prisma | MySQL | Examples |
|---|---|---|---|
| Currency codes | `String @db.VarChar(10)` | `VARCHAR(10)` | `currency`, `currency_code` |
| Status, type, platform | `String @db.VarChar(50)` | `VARCHAR(50)` | `status`, `type`, `platform` |
| External IDs (Klaviyo, Facebook) | `String @db.VarChar(50)` | `VARCHAR(50)` | `klaviyo_id`, `facebook_id` |
| Job type, tax rule, account code | `String @db.VarChar(100)` | `VARCHAR(100)` | `job_type`, `tax_rule`, `account_code` |
| Names, emails, addresses, URLs | `String @db.VarChar(255)` | `VARCHAR(255)` | `name`, `email`, `company` |
| Short descriptions, error messages | `String @db.VarChar(500)` | `VARCHAR(500)` | `short_description`, `error_message` |
| Notes, descriptions | `String @db.Text` | `TEXT` (64 KB) | `note`, `description`, `internal_note` |
| Auth tokens, large payloads | `String @db.LongText` | `LONGTEXT` (4 GB) | `access_token` |

---

## 9. Dates and Timestamps

Every platform uses strings for dates in API responses — always convert to `Date` in the transformer before storing.

| Platform | Date format | Example | Transformer action |
|---|---|---|---|
| Cin7 | ISO 8601 | `"2026-04-13T12:00:00Z"` | `new Date(value)` |
| Shopify | ISO 8601 with timezone | `"2026-04-13T16:15:47-04:00"` | `new Date(value)` |
| Klaviyo | ISO 8601 RFC 3339 | `"2026-04-13T14:30:45+00:00"` | `new Date(value)` |
| Facebook | `YYYY-MM-DD` | `"2026-04-13"` | `new Date(value)` |
| GA4 | `YYYYMMDD` | `"20260413"` | parse manually → `new Date(year, month-1, day)` |

All timestamps use `DATETIME(3)` in MySQL — 3 decimal places = millisecond precision.

| Category | Prisma | MySQL | TypeScript (API) | TypeScript (transformer input) |
|---|---|---|---|---|
| Our row insert time | `DateTime @default(now()) @map("created_at") @db.DateTime(3)` | `DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)` | — auto | — auto |
| Our row update time | `DateTime @default(now()) @updatedAt @map("modified_at") @db.DateTime(3)` | `DATETIME(3) ON UPDATE CURRENT_TIMESTAMP(3)` | — auto | — auto |
| Source platform created | `DateTime @map("src_created_at") @db.DateTime(3)` | `DATETIME(3)` | `string` | `Date` |
| Source platform modified | `DateTime @map("src_modified_at") @db.DateTime(3)` | `DATETIME(3)` | `string` | `Date` |
| Business domain date | `DateTime? @db.DateTime(3)` | `DATETIME(3)` | `string \| null` | `Date \| null` |
| Sync timestamp | `DateTime @map("synced_at") @db.DateTime(3)` | `DATETIME(3)` | — | `Date` (generated once per worker job, shared across all records in the run) |
| GA4 report date (dimension) | `DateTime @map("report_date") @db.DateTime(3)` | `DATETIME(3)` | `string` (`YYYYMMDD`) | parse → `Date` |

**Never use `@db.Date`** (date-only) — always use `DateTime(3)` even for date-only fields to avoid timezone truncation bugs.

---

## 10. Booleans

| Platform | API format | Notes |
|---|---|---|
| Cin7 | `boolean` | Native true/false |
| Shopify | `boolean \| null` | `taxes_included` can be null |
| Klaviyo | `boolean` | Native true/false |
| Facebook | not documented | Treat as nullable |

| Layer | Type | Notes |
|---|---|---|
| Prisma | `Boolean @default(true/false)` | Always set explicit default |
| MySQL | `TINYINT(1)` | Stored as 0/1 |
| TypeScript (API) | `boolean` or `boolean \| null` | Use `?? false` in transformer for nullable |

---

## 11. JSON Blobs

| Layer | Type | Notes |
|---|---|---|
| Prisma | `Json @map("raw_data")` | Native MySQL JSON |
| MySQL | `JSON` | Queryable, indexable |
| TypeScript (input) | `object` | Pass raw API response object directly |

**Rule:** Every platform sync table must have a `raw_data Json` field storing the full API response.
- Store the full API response for each **individual record** (not the page/batch wrapper)
- This enables debugging and re-processing without re-fetching from the API
- Size is bounded by MySQL's `max_allowed_packet` (default 64 MB) — individual records never approach this

---

## 12. Counts / Durations / Config Integers

| Category | Prisma | MySQL | Examples |
|---|---|---|---|
| Sync record counts | `Int?` | `INT` nullable | `records_fetched`, `records_saved` |
| Durations (ms) | `Int?` | `INT` nullable | `duration_ms` |
| Interval config | `Int` | `INT` | `interval_minutes` |

---

## Quick Reference Cheat Sheet

```
order totals / tax / shipping amounts → Decimal(12, 2)
unit price / cost price (product)     → Decimal(12, 4)   — Cin7 uses up to 4dp
line item unit price                  → Decimal(12, 4)
line item tax / line item total       → Decimal(12, 2)
quantity / stock level                → Decimal(12, 4)
exchange rate                         → Decimal(12, 6)
line item discount %                  → Decimal(8, 2)    — Cin7: 0–100%, 2dp
contact discount %                    → Decimal(8, 4)
dimension / weight                    → Decimal(10, 4)
ad spend / revenue       → Decimal(12, 2)
ad clicks / impressions  → Int
ad rate / CTR            → Decimal(8, 4)

surrogate PK             → BigInt UNSIGNED AUTO_INCREMENT
Cin7 / Shopify ID        → Int
Klaviyo / Facebook ID    → VarChar(50)      — they are strings, not numbers

currency code            → VarChar(10)
status / type / platform → VarChar(50)
job type / tax rule      → VarChar(100)
name / email / url       → VarChar(255)
short description        → VarChar(500)
notes / description      → Text
auth token               → LongText

boolean                  → Boolean (always with @default)
any timestamp            → DateTime(3)      — never @db.Date
GA4 date dimension       → DateTime(3)      — parse YYYYMMDD manually
raw API response         → Json             — every sync table must have raw_data
```
