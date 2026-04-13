-- Rename camelCase columns to snake_case (no data loss, ALTER only)
-- Table: sync_logs

ALTER TABLE `sync_logs`
  RENAME COLUMN `jobType`        TO `job_type`,
  RENAME COLUMN `recordsFetched` TO `records_fetched`,
  RENAME COLUMN `recordsSaved`   TO `records_saved`,
  RENAME COLUMN `recordsSkipped` TO `records_skipped`,
  RENAME COLUMN `errorMessage`   TO `error_message`,
  RENAME COLUMN `durationMs`     TO `duration_ms`,
  RENAME COLUMN `createdAt`      TO `created_at`,
  RENAME COLUMN `updatedAt`      TO `updated_at`;

-- Table: sync_config

ALTER TABLE `sync_config`
  RENAME COLUMN `jobType`         TO `job_type`,
  RENAME COLUMN `lastSyncedAt`    TO `last_synced_at`,
  RENAME COLUMN `intervalMinutes` TO `interval_minutes`,
  RENAME COLUMN `createdAt`       TO `created_at`,
  RENAME COLUMN `updatedAt`       TO `updated_at`;

-- Rename index that referenced camelCase columns (auto-named by Prisma)
-- Original: sync_config_platform_jobType_key
-- MySQL does not support RENAME INDEX in all versions; drop and recreate is safe here
-- (no data loss — this only affects the index structure, not column data)
ALTER TABLE `sync_config`
  DROP INDEX `sync_config_platform_jobType_key`,
  ADD  UNIQUE INDEX `sync_config_platform_job_type_key` (`platform`, `job_type`);
