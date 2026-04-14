-- CreateTable
CREATE TABLE `klaviyo_campaigns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `klaviyo_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NULL,
    `status` VARCHAR(50) NULL,
    `channel` VARCHAR(50) NULL,
    `send_time` DATETIME(3) NULL,
    `src_created_at` DATETIME(3) NULL,
    `src_modified_at` DATETIME(3) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `klaviyo_campaigns_klaviyo_id_key`(`klaviyo_id`),
    INDEX `idx_klaviyo_campaigns_src_modified_at`(`src_modified_at`),
    INDEX `idx_klaviyo_campaigns_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `klaviyo_campaign_stats` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `klaviyo_id` VARCHAR(50) NOT NULL,
    `delivered` INTEGER NULL,
    `opens` INTEGER NULL,
    `opens_unique` INTEGER NULL,
    `open_rate` DECIMAL(8, 4) NULL,
    `clicks` INTEGER NULL,
    `clicks_unique` INTEGER NULL,
    `click_rate` DECIMAL(8, 4) NULL,
    `unsubscribes` INTEGER NULL,
    `bounces` INTEGER NULL,
    `conversions` INTEGER NULL,
    `conversion_rate` DECIMAL(8, 4) NULL,
    `conversion_value` DECIMAL(12, 2) NULL,
    `revenue_per_recipient` DECIMAL(12, 2) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `klaviyo_campaign_stats_klaviyo_id_key`(`klaviyo_id`),
    INDEX `idx_klaviyo_campaign_stats_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `klaviyo_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `klaviyo_id` VARCHAR(50) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone_number` VARCHAR(50) NULL,
    `first_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NULL,
    `email_consent` VARCHAR(50) NULL,
    `sms_consent` VARCHAR(50) NULL,
    `country` VARCHAR(100) NULL,
    `city` VARCHAR(255) NULL,
    `region` VARCHAR(255) NULL,
    `zip` VARCHAR(20) NULL,
    `timezone` VARCHAR(100) NULL,
    `lifecycle_stage` VARCHAR(100) NULL,
    `signup_source` VARCHAR(255) NULL,
    `src_created_at` DATETIME(3) NULL,
    `src_modified_at` DATETIME(3) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `klaviyo_profiles_klaviyo_id_key`(`klaviyo_id`),
    INDEX `idx_klaviyo_profiles_src_modified_at`(`src_modified_at`),
    INDEX `idx_klaviyo_profiles_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `klaviyo_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `klaviyo_id` VARCHAR(50) NOT NULL,
    `metric_id` VARCHAR(50) NULL,
    `profile_id` VARCHAR(50) NULL,
    `value` DECIMAL(12, 2) NULL,
    `event_date` DATETIME(3) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `klaviyo_events_klaviyo_id_key`(`klaviyo_id`),
    INDEX `idx_klaviyo_events_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `klaviyo_flows` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `klaviyo_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NULL,
    `status` VARCHAR(50) NULL,
    `archived` BOOLEAN NULL,
    `trigger_type` VARCHAR(100) NULL,
    `src_created_at` DATETIME(3) NULL,
    `src_modified_at` DATETIME(3) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `klaviyo_flows_klaviyo_id_key`(`klaviyo_id`),
    INDEX `idx_klaviyo_flows_src_modified_at`(`src_modified_at`),
    INDEX `idx_klaviyo_flows_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
