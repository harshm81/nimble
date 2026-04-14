-- CreateTable
CREATE TABLE `ga4_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` VARCHAR(50) NOT NULL,
    `report_date` DATETIME(3) NOT NULL,
    `source` VARCHAR(100) NOT NULL,
    `medium` VARCHAR(100) NOT NULL,
    `campaign` VARCHAR(100) NOT NULL,
    `device_category` VARCHAR(50) NOT NULL,
    `sessions` INTEGER NOT NULL,
    `total_users` INTEGER NOT NULL,
    `new_users` INTEGER NOT NULL,
    `page_views` INTEGER NOT NULL,
    `engagement_seconds` INTEGER NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ga4_sessions_report_date`(`report_date`),
    INDEX `idx_ga4_sessions_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_ga4_sessions_key`(`property_id`, `report_date`, `source`, `medium`, `campaign`, `device_category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ga4_ecommerce_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` VARCHAR(50) NOT NULL,
    `report_date` DATETIME(3) NOT NULL,
    `event_name` VARCHAR(100) NOT NULL,
    `source` VARCHAR(100) NOT NULL,
    `medium` VARCHAR(100) NOT NULL,
    `transactions` INTEGER NOT NULL,
    `revenue` DECIMAL(12, 2) NOT NULL,
    `add_to_carts` INTEGER NOT NULL,
    `checkouts` INTEGER NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ga4_ecommerce_events_report_date`(`report_date`),
    INDEX `idx_ga4_ecommerce_events_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_ga4_ecommerce_events_key`(`property_id`, `report_date`, `event_name`, `source`, `medium`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ga4_product_data` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `property_id` VARCHAR(50) NOT NULL,
    `report_date` DATETIME(3) NOT NULL,
    `item_id` VARCHAR(100) NULL,
    `item_name` VARCHAR(255) NULL,
    `item_brand` VARCHAR(255) NULL,
    `item_category` VARCHAR(255) NULL,
    `item_views` INTEGER NOT NULL,
    `add_to_carts` INTEGER NOT NULL,
    `purchases` INTEGER NOT NULL,
    `revenue` DECIMAL(12, 2) NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_ga4_product_data_report_date`(`report_date`),
    INDEX `idx_ga4_product_data_synced_at`(`synced_at`),
    UNIQUE INDEX `uq_ga4_product_data_key`(`property_id`, `report_date`, `item_id`, `item_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
