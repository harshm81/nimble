-- Add shopify_cart_events table for webhook-received cart create/update events.

CREATE TABLE `shopify_cart_events` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shopify_cart_id`  VARCHAR(255) NOT NULL,
  `event_type`       VARCHAR(50) NOT NULL,
  `customer_email`   VARCHAR(255) NULL,
  `customer_id`      VARCHAR(255) NULL,
  `line_items_count` INT NULL,
  `total_price`      DECIMAL(12, 2) NULL,
  `currency`         VARCHAR(10) NULL,
  `src_created_at`   DATETIME(3) NOT NULL,
  `src_modified_at`  DATETIME(3) NOT NULL,
  `raw_data`         JSON NOT NULL,
  `synced_at`        DATETIME(3) NOT NULL,
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `modified_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `shopify_cart_events_shopify_cart_id_key` (`shopify_cart_id`),
  INDEX `idx_shopify_cart_events_customer_email` (`customer_email`),
  INDEX `idx_shopify_cart_events_event_type` (`event_type`),
  INDEX `idx_shopify_cart_events_src_modified_at` (`src_modified_at`),
  INDEX `idx_shopify_cart_events_synced_at` (`synced_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
