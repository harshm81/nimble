-- Standardize existing tables to project schema conventions:
--   - id: BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
--   - created_at: DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
--   - modified_at: DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
--   - VARCHAR widths sized to actual content (not Prisma's default 191)
--
-- platform_tokens has no surrogate PK (platform IS the PK) — only timestamps updated.
-- No data loss — all changes are ALTER COLUMN / ADD COLUMN only.

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_logs
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `sync_logs`
  -- Upgrade PK to BIGINT UNSIGNED
  MODIFY COLUMN `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Tighten VARCHAR widths
  MODIFY COLUMN `platform`        VARCHAR(50)  NOT NULL,
  MODIFY COLUMN `job_type`        VARCHAR(100) NOT NULL,
  MODIFY COLUMN `status`          VARCHAR(20)  NOT NULL,
  MODIFY COLUMN `error_message`   VARCHAR(1000) NULL,

  -- Rename updated_at → modified_at and add ON UPDATE trigger
  CHANGE COLUMN `updated_at` `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- Index on modified_at for time-range queries
ALTER TABLE `sync_logs`
  ADD INDEX `idx_sync_logs_modified_at` (`modified_at`),
  ADD INDEX `idx_sync_logs_platform_job_type` (`platform`, `job_type`);

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_config
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `sync_config`
  -- Upgrade PK to BIGINT UNSIGNED
  MODIFY COLUMN `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Tighten VARCHAR widths
  MODIFY COLUMN `platform`        VARCHAR(50)  NOT NULL,
  MODIFY COLUMN `job_type`        VARCHAR(100) NOT NULL,

  -- Rename updated_at → modified_at and add ON UPDATE trigger
  CHANGE COLUMN `updated_at` `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- ─────────────────────────────────────────────────────────────────────────────
-- platform_tokens
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `platform_tokens`
  -- Tighten PK VARCHAR width
  MODIFY COLUMN `platform`    VARCHAR(50) NOT NULL,

  -- Add created_at (was missing)
  ADD COLUMN `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)  AFTER `access_token`,

  -- Rename updated_at → modified_at with ON UPDATE trigger
  CHANGE COLUMN `updated_at` `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
