-- Upgrade all cin7 table primary keys from INT to BIGINT UNSIGNED.
--
-- Standard: every table with a surrogate PK uses BIGINT UNSIGNED AUTO_INCREMENT.
-- sync_logs and sync_config were already upgraded in 20260410200000_standardize_schema.
-- platform_tokens uses a natural VARCHAR PK (platform name) — no surrogate id needed.
--
-- No data loss — MODIFY COLUMN on an auto_increment PK is safe, existing values are preserved.

ALTER TABLE `cin7_orders`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_order_line_items`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_contacts`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_products`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_inventory`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_purchase_orders`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_credit_notes`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_stock_adjustments`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `cin7_branches`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;
