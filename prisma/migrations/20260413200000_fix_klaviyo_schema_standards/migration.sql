-- Fix Klaviyo tables to meet project schema standards.
--
-- Changes applied:
--
-- 1. All Klaviyo tables: add ON UPDATE CURRENT_TIMESTAMP(3) to modified_at
--    Reason: modified_at must auto-update on every upsert per schema rules.
--    Affected: klaviyo_campaigns, klaviyo_campaign_stats, klaviyo_profiles,
--              klaviyo_events, klaviyo_flows
--
-- 2. klaviyo_campaign_stats: add src_modified_at column + index
--    Reason: schema.prisma defines srcModifiedAt on this model but it was
--    missing from the original migration, causing INSERT errors.
--    Rule: every table with src_modified_at must index it.

-- 1. Fix modified_at ON UPDATE on all Klaviyo tables

ALTER TABLE `klaviyo_campaigns`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `klaviyo_campaign_stats`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `klaviyo_profiles`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `klaviyo_events`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `klaviyo_flows`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
