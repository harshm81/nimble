-- CreateTable
CREATE TABLE `sync_log_daily_summary` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `job_type` VARCHAR(100) NOT NULL,
    `total_runs` INTEGER NOT NULL,
    `success_count` INTEGER NOT NULL,
    `failure_count` INTEGER NOT NULL,
    `total_records_fetched` INTEGER NULL,
    `total_records_saved` INTEGER NULL,
    `total_records_failed` INTEGER NULL,
    `avg_duration_ms` INTEGER NULL,
    `max_duration_ms` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sync_log_daily_summary_date`(`date`),
    UNIQUE INDEX `sync_log_daily_summary_date_platform_job_type_key`(`date`, `platform`, `job_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
