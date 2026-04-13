-- Add shopify_product_variants table and drop shopify_abandoned_checkouts.

CREATE TABLE `shopify_product_variants` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shopify_product_id`  VARCHAR(255) NOT NULL,
  `shopify_variant_id`  VARCHAR(255) NOT NULL,
  `title`               VARCHAR(255) NULL,
  `sku`                 VARCHAR(255) NULL,
  `price`               DECIMAL(12, 4) NULL,
  `compare_at_price`    DECIMAL(12, 4) NULL,
  `inventory_quantity`  INT NULL,
  `position`            INT NULL,
  `src_created_at`      DATETIME(3) NOT NULL,
  `src_modified_at`     DATETIME(3) NOT NULL,
  `raw_data`            JSON NOT NULL,
  `synced_at`           DATETIME(3) NOT NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `modified_at`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `shopify_product_variants_shopify_variant_id_key` (`shopify_variant_id`),
  INDEX `idx_shopify_product_variants_product_id` (`shopify_product_id`),
  INDEX `idx_shopify_product_variants_sku` (`sku`),
  INDEX `idx_shopify_product_variants_src_modified_at` (`src_modified_at`),
  INDEX `idx_shopify_product_variants_synced_at` (`synced_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `shopify_abandoned_checkouts`;
