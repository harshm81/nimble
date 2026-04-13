-- CreateTable
CREATE TABLE `shopify_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_id` VARCHAR(255) NOT NULL,
    `order_name` VARCHAR(50) NULL,
    `customer_email` VARCHAR(255) NULL,
    `financial_status` VARCHAR(50) NULL,
    `fulfillment_status` VARCHAR(50) NULL,
    `total_price` DECIMAL(12, 2) NULL,
    `subtotal_price` DECIMAL(12, 2) NULL,
    `total_tax` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL,
    `order_date` DATETIME(3) NULL,
    `src_modified_at` DATETIME(3) NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_orders_shopify_id_key`(`shopify_id`),
    INDEX `idx_shopify_orders_customer_email`(`customer_email`),
    INDEX `idx_shopify_orders_order_date`(`order_date`),
    INDEX `idx_shopify_orders_src_modified_at`(`src_modified_at`),
    INDEX `idx_shopify_orders_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_order_line_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_order_id` VARCHAR(255) NOT NULL,
    `shopify_line_item_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `sku` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `original_unit_price` DECIMAL(12, 2) NULL,
    `discounted_unit_price` DECIMAL(12, 2) NULL,
    `total_discount` DECIMAL(12, 2) NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_order_line_items_shopify_line_item_id_key`(`shopify_line_item_id`),
    INDEX `idx_shopify_order_line_items_order_id`(`shopify_order_id`),
    INDEX `idx_shopify_order_line_items_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_refunds` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_order_id` VARCHAR(255) NOT NULL,
    `shopify_refund_id` VARCHAR(255) NOT NULL,
    `refunded_at` DATETIME(3) NOT NULL,
    `note` TEXT NULL,
    `total_refunded` DECIMAL(12, 2) NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_refunds_shopify_refund_id_key`(`shopify_refund_id`),
    INDEX `idx_shopify_refunds_order_id`(`shopify_order_id`),
    INDEX `idx_shopify_refunds_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_customers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_id` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `first_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_customers_shopify_id_key`(`shopify_id`),
    INDEX `idx_shopify_customers_email`(`email`),
    INDEX `idx_shopify_customers_src_modified_at`(`src_modified_at`),
    INDEX `idx_shopify_customers_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_id` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_products_shopify_id_key`(`shopify_id`),
    INDEX `idx_shopify_products_status`(`status`),
    INDEX `idx_shopify_products_src_modified_at`(`src_modified_at`),
    INDEX `idx_shopify_products_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_inventory` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_id` VARCHAR(255) NOT NULL,
    `available` INTEGER NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_inventory_shopify_id_key`(`shopify_id`),
    INDEX `idx_shopify_inventory_src_modified_at`(`src_modified_at`),
    INDEX `idx_shopify_inventory_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_abandoned_checkouts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shopify_id` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `src_created_at` DATETIME(3) NOT NULL,
    `src_modified_at` DATETIME(3) NOT NULL,
    `raw_data` JSON NOT NULL,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shopify_abandoned_checkouts_shopify_id_key`(`shopify_id`),
    INDEX `idx_shopify_abandoned_checkouts_email`(`email`),
    INDEX `idx_shopify_abandoned_checkouts_src_modified_at`(`src_modified_at`),
    INDEX `idx_shopify_abandoned_checkouts_synced_at`(`synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
