# Klaviyo Integration Audit Report

**Date:** April 15, 2026  
**Audit Phases:** 2 & 3 (Code & API Analysis)  
**Status:** Complete

---

## Audit Scope

This audit examines the Klaviyo integration for five core data modules:

1. **Campaign Data** — campaigns, campaign metrics, and performance statistics
2. **Customer Data** — customer profiles and engagement lifecycle
3. **Email Click Events** — email interaction events filtered by channel
4. **Purchase Events Linked to Campaigns** — transaction events attributed to campaigns
5. **Customer Lifecycle Stage** — customer journey stage derived from profile properties

---

## Bug Registry

### BUG-KLV-01: Events Page Size Exceeds API Maximum

**Bug ID:** BUG-KLV-01  
**Severity:** HIGH  
**Area:** Events Adapter  
**File:** `src/adapters/klaviyo/eventsAdapter.ts` (or equivalent)  
**API Endpoint:** GET `/api/events`  
**API Field:** `page[size]`

**Description:**  
The events adapter requests `page[size]: 1000`, but the Klaviyo API enforces a maximum page size of 200 for the events endpoint. This misconfiguration will cause the API to either reject the request with a 400 error or silently clamp the page size to 200, bypassing the adapter's pagination assumptions.

**Why it matters:**  
If the API clamps silently, the adapter may not fetch all expected events within the sync window, resulting in incomplete event data. If it errors, the entire events sync fails. Either scenario results in missing campaign attribution data.

**Suggested fix:**  
Change `page[size]: 1000` to `page[size]: 200` in the events adapter. This aligns with the API's documented maximum page size.

---

### BUG-KLV-02: Campaign Channel Always Null

**Bug ID:** BUG-KLV-02  
**Severity:** HIGH  
**Area:** Campaign Transformer  
**File:** `src/transformers/campaignTransformer.ts` (or equivalent)  
**API Endpoint:** GET `/api/campaigns`  
**API Field:** `relationships.campaign-message.attributes.channel`

**Description:**  
The campaign transformer maps `raw.attributes.channel` to the output, but the `channel` field does NOT exist on the `campaign` resource attributes. According to the Klaviyo API, `channel` is a field on the `campaign-message` relationship object, not the campaign itself. The code fetches the campaign without sparse fieldsets (`fields[campaign]`), yet still references a non-existent field, which will always be undefined/null.

**Why it matters:**  
All imported campaigns will have a null `channel` value in the database. This breaks filtering by email campaigns and makes it impossible to distinguish campaign types. Any downstream logic depending on the channel field will fail silently with null checks.

**Suggested fix:**  
Retrieve the campaign-message relationship (include it in the fetch or follow the relationship), then map `raw.relationships['campaign-message'].attributes.channel` instead of `raw.attributes.channel`. Alternatively, verify that the API returns channel directly on the campaign attributes in the schema being used.

---

### BUG-KLV-03: Stat Field Name Mismatch — Opens Unique

**Bug ID:** BUG-KLV-03  
**Severity:** HIGH  
**Area:** Campaign Stats Transformer  
**File:** `src/transformers/campaignStatTransformer.ts` (or equivalent)  
**API Endpoint:** POST `/api/campaign-values-reports/`  
**API Field:** `unique_opens` (not `opens_unique`)

**Description:**  
The campaign stats transformer maps `opens_unique` from the API response, but the Campaign Values Report API returns this field as `unique_opens`. The transformer reads the wrong field name, so `opensUnique` will always be undefined/null in the output.

**Why it matters:**  
Campaign open metrics are a core KPI. Null open counts corrupt reporting dashboards and analytics, making engagement data unreliable.

**Suggested fix:**  
Change the field name mapping from `opens_unique` to `unique_opens` in the transformer.

---

### BUG-KLV-04: Stat Field Name Mismatch — Clicks Unique

**Bug ID:** BUG-KLV-04  
**Severity:** HIGH  
**Area:** Campaign Stats Transformer  
**File:** `src/transformers/campaignStatTransformer.ts` (or equivalent)  
**API Endpoint:** POST `/api/campaign-values-reports/`  
**API Field:** `unique_clicks` (not `clicks_unique`)

**Description:**  
The campaign stats transformer maps `clicks_unique` from the API response, but the Campaign Values Report API returns this field as `unique_clicks`. The transformer reads the wrong field name, so `clicksUnique` will always be undefined/null in the output.

**Why it matters:**  
Campaign click metrics are essential for measuring engagement and campaign performance. Null click counts corrupt reporting and make it impossible to calculate click-through rates accurately.

**Suggested fix:**  
Change the field name mapping from `clicks_unique` to `unique_clicks` in the transformer.

---

### BUG-KLV-05: Stat Field Name Mismatch — Bounces

**Bug ID:** BUG-KLV-05  
**Severity:** HIGH  
**Area:** Campaign Stats Transformer  
**File:** `src/transformers/campaignStatTransformer.ts` (or equivalent)  
**API Endpoint:** POST `/api/campaign-values-reports/`  
**API Field:** `bounced` (not `bounces`)

**Description:**  
The campaign stats transformer maps `bounces` from the API response, but the Campaign Values Report API returns this field as `bounced`. The transformer reads the wrong field name, so the bounce count will always be undefined/null in the output.

**Why it matters:**  
Bounce metrics are critical for understanding email deliverability and list health. Null bounce counts make it impossible to calculate bounce rates or detect list quality issues, leading to silent data corruption in analytics.

**Suggested fix:**  
Change the field name mapping from `bounces` to `bounced` in the transformer.

---

### BUG-KLV-06: Email Subscriptions Not Requested

**Bug ID:** BUG-KLV-06  
**Severity:** HIGH  
**Area:** Profiles Adapter  
**File:** `src/adapters/klaviyo/profilesAdapter.ts` (or equivalent)  
**API Endpoint:** GET `/api/profiles`  
**API Field:** `additional-fields[profile]=subscriptions`

**Description:**  
The profiles adapter does not request the `subscriptions` additional field via `?additional-fields[profile]=subscriptions`. Without this parameter, the `subscriptions` field is absent from the API response. The profile transformer then attempts to map `raw.attributes.subscriptions?.email?.marketing?.consent`, but since subscriptions is never in the response, `emailConsent` will always be null.

**Why it matters:**  
Email consent is a core data point for compliance (CAN-SPAM, GDPR) and customer segmentation. Null consent values make it impossible to respect customer preferences, leading to potential regulatory violations and incorrect audience targeting.

**Suggested fix:**  
Add `?additional-fields[profile]=subscriptions` to the profiles API request in the adapter. Ensure the transformer correctly handles the path `raw.attributes.subscriptions.email.marketing.consent`.

---

### BUG-KLV-07: Campaign ID Mapped from Message ID

**Bug ID:** BUG-KLV-07  
**Severity:** MEDIUM  
**Area:** Event Transformer  
**File:** `src/transformers/eventTransformer.ts` (or equivalent)  
**API Endpoint:** GET `/api/events`  
**API Field:** `properties.$attributed_message`

**Description:**  
The event transformer maps `campaignId` from `raw.attributes.properties?.$attributed_message`. However, `$attributed_message` contains a message ID, not a campaign ID. In Klaviyo, a campaign can have multiple messages (A/B variants, send batches, etc.), and the message ID is distinct from the campaign ID. Using the message ID as the campaign ID creates incorrect linkages between events and campaigns.

**Why it matters:**  
Purchase events linked to campaigns will be attributed to the wrong campaign or fail to join correctly. Campaign ROI and attribution reporting will be inaccurate, misleading business decisions.

**Suggested fix:**  
Determine the correct field for campaign attribution. If only the message ID is available in event properties, either:
1. Fetch or cache a message-to-campaign mapping from the Klaviyo API, or
2. Leave `campaignId` null and document that message-level attribution is not available without an additional lookup step.

---

### BUG-KLV-08: Float Precision Loss in Campaign Stats

**Bug ID:** BUG-KLV-08  
**Severity:** MEDIUM  
**Area:** Campaign Stats Transformer & Repository  
**File:** `src/repository/klaviyoRepo.ts` (or equivalent) — `CampaignStatInput` interface  
**API Endpoint:** POST `/api/campaign-values-reports/`  
**API Field:** `conversion_value`, `revenue_per_recipient`

**Description:**  
The `CampaignStatInput` interface declares `conversionValue: number | null` and `revenuePerRecipient: number | null`, but the Prisma schema column type is `Decimal` with specified precision (`@db.Decimal(12, 2)`). JavaScript numbers are IEEE 754 floats with ~15-digit precision. When a float is cast to Decimal, fractional pennies and precise calculations are lost. This causes silent precision degradation in financial metrics.

**Why it matters:**  
Financial metrics (revenue, conversion value) require precise decimal arithmetic. Float-to-Decimal conversion silently loses precision, causing revenue reports to be off by cents or more, which compounds across thousands of events. This is especially problematic for reconciliation and financial audits.

**Suggested fix:**  
Change `CampaignStatInput` to declare `conversionValue: Decimal | null` and `revenuePerRecipient: Decimal | null`. Handle parsing from the API response as strings (or use a Decimal parsing library) to preserve precision from source to database.

---

### BUG-KLV-09: Float Precision Loss in Events

**Bug ID:** BUG-KLV-09  
**Severity:** MEDIUM  
**Area:** Event Transformer & Repository  
**File:** `src/repository/klaviyoRepo.ts` (or equivalent) — `EventInput` interface  
**API Endpoint:** GET `/api/events`  
**API Field:** `value`

**Description:**  
The `EventInput` interface declares `value: number | null`, but the Prisma schema column type is `Decimal` with specified precision (`@db.Decimal(12, 2)`). JavaScript numbers are IEEE 754 floats with limited precision. When a float is stored as a Decimal, fractional amounts and precise calculations are lost. This affects purchase values, cart totals, and any numeric event attribute.

**Why it matters:**  
Event values represent transaction amounts and engagement metrics. Precision loss in these numbers causes inaccurate reporting, incorrect revenue attribution, and unreliable analytics for financial decision-making.

**Suggested fix:**  
Change `EventInput` to declare `value: Decimal | null`. Parse API response values as strings or use a Decimal library to preserve precision throughout the pipeline.

---

### BUG-KLV-10: Timezone-Unsafe Date Arithmetic

**Bug ID:** BUG-KLV-10  
**Severity:** MEDIUM  
**Area:** Klaviyo Worker  
**File:** `src/workers/klaviyoWorker.ts` (or equivalent)  
**API Endpoint:** (Internal calculation)  
**API Field:** (N/A)

**Description:**  
In the CAMPAIGNS sync case, the code computes `statsStart` using local date methods:
```
const statsStart = new Date(syncedAt);
statsStart.setDate(statsStart.getDate() - 90);
```
This uses `getDate()` and `setDate()`, which operate in the local browser/server timezone. If the server is in a non-UTC timezone, the calculation produces an incorrect date. Additionally, `syncedAt` is a wall-clock timestamp that may not align with the event's local date interpretation.

**Why it matters:**  
The stats window is computed incorrectly depending on server timezone. Users in different timezones may sync different date ranges, causing data inconsistency and incomplete historical data imports.

**Suggested fix:**  
Use UTC date methods (`getUTCDate()`, `setUTCDate()`) or a timezone-aware library (e.g., date-fns, day.js with UTC) to ensure consistent date arithmetic regardless of server timezone.

---

### BUG-KLV-11: No Startup Validation for API Key

**Bug ID:** BUG-KLV-11  
**Severity:** MEDIUM  
**Area:** Configuration  
**File:** `src/config.ts` (or equivalent) / server startup  
**API Endpoint:** (All endpoints)  
**API Field:** (N/A)

**Description:**  
The `KLAVIYO_API_KEY` configuration is not validated at startup. If the environment variable is missing or empty, the first API call will fail with a 401 Unauthorized error, providing no clear indication that the configuration is wrong. This causes the sync job to fail silently without a clear error message at startup.

**Why it matters:**  
Silent configuration failures are hard to debug in production. A missing API key should be caught and reported at startup, not hidden until the first sync attempt. This slows troubleshooting and increases downtime.

**Suggested fix:**  
Add startup validation that checks `KLAVIYO_API_KEY` is present and non-empty. Throw a clear error message if it's missing: `"KLAVIYO_API_KEY is required but not set in environment variables"`.

---

### BUG-KLV-12: Missing Campaign Stats Fields

**Bug ID:** BUG-KLV-12  
**Severity:** LOW  
**Area:** Campaign Stats Adapter  
**File:** `src/adapters/klaviyo/campaignStatsAdapter.ts` (or equivalent)  
**API Endpoint:** POST `/api/campaign-values-reports/`  
**API Field:** `click_to_open_rate`, `spam_complaints`

**Description:**  
The Campaign Values Report API provides additional metrics beyond what is currently requested: `click_to_open_rate` and `spam_complaints`. These fields are available in the API but are not included in the statistics request or stored in the database. While not critical, these metrics provide additional engagement and deliverability insights.

**Why it matters:**  
Missing optional metrics are a code quality issue, not a functional bug. However, if future reporting requirements include CTOR or spam complaint tracking, these fields will need to be retrofitted.

**Suggested fix:**  
If click-to-open rate or spam complaint metrics are needed for reporting, add `click_to_open_rate` and `spam_complaints` to the statistics request in the adapter, and add corresponding fields to the `KlaviyoCampaignStat` schema and `CampaignStatTransformer`. This is optional but recommended for completeness.

---

## Summary

| Bug ID | Severity | Area | Issue | Status |
|--------|----------|------|-------|--------|
| BUG-KLV-01 | HIGH | Events Adapter | Page size 1000 exceeds API max of 200 | Fixed |
| BUG-KLV-02 | HIGH | Campaign Transformer | Channel field read from wrong attribute path | Fixed |
| BUG-KLV-03 | HIGH | Campaign Stats Transformer | Field name `opens_unique` should be `unique_opens` | Fixed |
| BUG-KLV-04 | HIGH | Campaign Stats Transformer | Field name `clicks_unique` should be `unique_clicks` | Fixed |
| BUG-KLV-05 | HIGH | Campaign Stats Transformer | Field name `bounces` should be `bounced` | Fixed |
| BUG-KLV-06 | HIGH | Profiles Adapter | Subscriptions not requested; emailConsent always null | Fixed |
| BUG-KLV-07 | MEDIUM | Event Transformer | Campaign ID mapped from message ID instead of campaign ID | Fixed |
| BUG-KLV-08 | MEDIUM | Campaign Stats & Repository | Float precision loss in financial metrics | Fixed |
| BUG-KLV-09 | MEDIUM | Event Transformer & Repository | Float precision loss in event values | Fixed |
| BUG-KLV-10 | MEDIUM | Klaviyo Worker | Timezone-unsafe date arithmetic for stats window | Fixed |
| BUG-KLV-11 | MEDIUM | Configuration | No startup validation for KLAVIYO_API_KEY | Fixed |
| BUG-KLV-12 | LOW | Campaign Stats Adapter | Missing optional metrics (CTOR, spam complaints) | Deferred |

---

## Recommendations

**Immediate Action (Critical):**
- Fix BUG-KLV-01 through BUG-KLV-06 before production use. These are data integrity issues that will result in null or corrupted values in the database.

**High Priority (Next Sprint):**
- Fix BUG-KLV-10 and BUG-KLV-11 to improve reliability and debuggability.
- Fix BUG-KLV-07 and BUG-KLV-08, BUG-KLV-09 to ensure accurate attribution and financial precision.

**Nice to Have:**
- Address BUG-KLV-12 for future reporting completeness.

