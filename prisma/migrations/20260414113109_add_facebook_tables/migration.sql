-- CreateTable
CREATE TABLE `facebook_campaigns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `campaign_id` VARCHAR(50) NOT NULL,
    `campaign_name` VARCHAR(255) NULL,
    `status` VARCHAR(50) NULL,
    `objective` VARCHAR(100) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facebook_campaigns_campaign_id_key`(`campaign_id`),
    INDEX `idx_facebook_campaigns_src_modified_at`(`src_modified_at`),
    INDEX `idx_facebook_campaigns_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facebook_adsets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `adset_id` VARCHAR(50) NOT NULL,
    `adset_name` VARCHAR(255) NULL,
    `campaign_id` VARCHAR(50) NULL,
    `status` VARCHAR(50) NULL,
    `daily_budget` DECIMAL(12, 2) NULL,
    `lifetime_budget` DECIMAL(12, 2) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facebook_adsets_adset_id_key`(`adset_id`),
    INDEX `idx_facebook_adsets_campaign_id`(`campaign_id`),
    INDEX `idx_facebook_adsets_src_modified_at`(`src_modified_at`),
    INDEX `idx_facebook_adsets_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facebook_ads` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ad_id` VARCHAR(50) NOT NULL,
    `ad_name` VARCHAR(255) NULL,
    `adset_id` VARCHAR(50) NULL,
    `campaign_id` VARCHAR(50) NULL,
    `status` VARCHAR(50) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facebook_ads_ad_id_key`(`ad_id`),
    INDEX `idx_facebook_ads_adset_id`(`adset_id`),
    INDEX `idx_facebook_ads_campaign_id`(`campaign_id`),
    INDEX `idx_facebook_ads_src_modified_at`(`src_modified_at`),
    INDEX `idx_facebook_ads_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facebook_campaign_insights` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `campaign_id` VARCHAR(50) NOT NULL,
    `campaign_name` VARCHAR(255) NULL,
    `report_date` DATETIME(3) NOT NULL,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `frequency` DECIMAL(8, 4) NULL,
    `ctr` DECIMAL(8, 4) NULL,
    `cpc` DECIMAL(12, 4) NULL,
    `cpm` DECIMAL(12, 4) NULL,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `add_to_carts` INTEGER NOT NULL DEFAULT 0,
    `initiate_checkouts` INTEGER NOT NULL DEFAULT 0,
    `landing_page_views` INTEGER NOT NULL DEFAULT 0,
    `conversions_json` JSON NULL,
    `conversion_values_json` JSON NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_facebook_campaign_insights_report_date`(`report_date`),
    INDEX `idx_facebook_campaign_insights_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_facebook_campaign_insights_key`(`campaign_id`, `report_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facebook_adset_insights` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `adset_id` VARCHAR(50) NOT NULL,
    `adset_name` VARCHAR(255) NULL,
    `campaign_id` VARCHAR(50) NULL,
    `campaign_name` VARCHAR(255) NULL,
    `report_date` DATETIME(3) NOT NULL,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `frequency` DECIMAL(8, 4) NULL,
    `ctr` DECIMAL(8, 4) NULL,
    `cpc` DECIMAL(12, 4) NULL,
    `cpm` DECIMAL(12, 4) NULL,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `add_to_carts` INTEGER NOT NULL DEFAULT 0,
    `initiate_checkouts` INTEGER NOT NULL DEFAULT 0,
    `landing_page_views` INTEGER NOT NULL DEFAULT 0,
    `conversions_json` JSON NULL,
    `conversion_values_json` JSON NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_facebook_adset_insights_campaign_id`(`campaign_id`),
    INDEX `idx_facebook_adset_insights_report_date`(`report_date`),
    INDEX `idx_facebook_adset_insights_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_facebook_adset_insights_key`(`adset_id`, `report_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facebook_ad_insights` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ad_id` VARCHAR(50) NOT NULL,
    `ad_name` VARCHAR(255) NULL,
    `adset_id` VARCHAR(50) NULL,
    `adset_name` VARCHAR(255) NULL,
    `campaign_id` VARCHAR(50) NULL,
    `campaign_name` VARCHAR(255) NULL,
    `report_date` DATETIME(3) NOT NULL,
    `spend` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `ctr` DECIMAL(8, 4) NULL,
    `cpc` DECIMAL(12, 4) NULL,
    `cpm` DECIMAL(12, 4) NULL,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `add_to_carts` INTEGER NOT NULL DEFAULT 0,
    `initiate_checkouts` INTEGER NOT NULL DEFAULT 0,
    `landing_page_views` INTEGER NOT NULL DEFAULT 0,
    `conversions_json` JSON NULL,
    `conversion_values_json` JSON NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_facebook_ad_insights_adset_id`(`adset_id`),
    INDEX `idx_facebook_ad_insights_campaign_id`(`campaign_id`),
    INDEX `idx_facebook_ad_insights_report_date`(`report_date`),
    INDEX `idx_facebook_ad_insights_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_facebook_ad_insights_key`(`ad_id`, `report_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
