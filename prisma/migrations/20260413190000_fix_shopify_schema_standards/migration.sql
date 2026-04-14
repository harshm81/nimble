-- Fix shopify table schema to meet project data type and index standards.
--
-- Changes applied:
--
-- 1. shopify_orders.order_name: VARCHAR(50) → VARCHAR(255)
--    Reason: names/emails/URLs must be VARCHAR(255) per datatypes standard.
--
-- 2. shopify_order_line_items: unit price columns DECIMAL(12,2) → DECIMAL(12,4)
--    Reason: unit prices must use 4dp per datatypes standard (order totals = 2dp, unit prices = 4dp).
--    Affected: original_unit_price, discounted_unit_price, total_discount
--
-- 3. shopify_order_line_items: add src_modified_at index
--    Reason: every table must index src_modified_at (incremental sync key) per schema rules.
--
-- 4. shopify_refunds: add src_modified_at index
--    Reason: same as above — missing from original migration.
--
-- 5. All shopify tables: add ON UPDATE CURRENT_TIMESTAMP(3) to modified_at
--    Reason: modified_at must auto-update on every upsert per schema rules.
--    Affected: shopify_orders, shopify_order_line_items, shopify_customers,
--              shopify_products, shopify_inventory, shopify_refunds

-- 1. Fix order_name column size
ALTER TABLE `shopify_orders`
  MODIFY COLUMN `order_name` VARCHAR(255) NULL;

-- 2. Fix unit price precision on line items
ALTER TABLE `shopify_order_line_items`
  MODIFY COLUMN `original_unit_price`   DECIMAL(12, 4) NULL,
  MODIFY COLUMN `discounted_unit_price` DECIMAL(12, 4) NULL,
  MODIFY COLUMN `total_discount`        DECIMAL(12, 4) NULL;

-- 3. Add src_modified_at column + index to shopify_order_line_items
ALTER TABLE `shopify_order_line_items`
  ADD COLUMN `src_modified_at` DATETIME(3) NULL;

ALTER TABLE `shopify_order_line_items`
  ADD INDEX `idx_shopify_order_line_items_src_modified_at` (`src_modified_at`);

-- 5. Fix modified_at ON UPDATE on all affected tables
ALTER TABLE `shopify_orders`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `shopify_order_line_items`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `shopify_customers`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `shopify_products`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `shopify_inventory`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `shopify_refunds`
  MODIFY COLUMN `modified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
