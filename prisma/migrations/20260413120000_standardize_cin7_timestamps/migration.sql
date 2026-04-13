-- Standardize timestamp columns across all cin7 tables.
--
-- Changes per table:
--   created_date  → src_created_at   (Cin7 API created timestamp)
--   updated_date  → src_modified_at  (Cin7 API modified timestamp — incremental sync key)
--   modified_date → src_modified_at  (cin7_orders only — same semantic)
--   updated_at    → modified_at      (our row audit timestamp)
--
-- All operations are RENAME COLUMN only — zero data loss.
-- New indexes added on src_modified_at and synced_at for sync query performance.

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_orders
-- modified_date and updated_at were already handled by the
-- 20260413082149_fix_order_line_items_and_schema_corrections migration.
-- Only rename updated_at → modified_at here; modified_date stays as-is.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_orders`
  RENAME COLUMN `updated_at` TO `modified_at`;

ALTER TABLE `cin7_orders`
  ADD INDEX `idx_cin7_orders_synced_at` (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_order_line_items
-- no created_date / updated_date from Cin7 API — src_* not applicable
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_order_line_items`
  RENAME COLUMN `updated_at` TO `modified_at`;

ALTER TABLE `cin7_order_line_items`
  ADD INDEX `idx_cin7_order_line_items_synced_at` (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_contacts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_contacts`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_contacts`
  ADD INDEX `idx_cin7_contacts_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_contacts_synced_at`       (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_products
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_products`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_products`
  ADD INDEX `idx_cin7_products_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_products_synced_at`       (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_inventory
-- no created_date / updated_date from Cin7 API — src_* not applicable
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_inventory`
  RENAME COLUMN `updated_at` TO `modified_at`;

ALTER TABLE `cin7_inventory`
  ADD INDEX `idx_cin7_inventory_synced_at` (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_purchase_orders
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_purchase_orders`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_purchase_orders`
  ADD INDEX `idx_cin7_purchase_orders_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_purchase_orders_synced_at`       (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_credit_notes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_credit_notes`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_credit_notes`
  ADD INDEX `idx_cin7_credit_notes_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_credit_notes_synced_at`       (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_stock_adjustments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_stock_adjustments`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_stock_adjustments`
  ADD INDEX `idx_cin7_stock_adjustments_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_stock_adjustments_synced_at`       (`synced_at`);

-- ─────────────────────────────────────────────────────────────────────────────
-- cin7_branches
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `cin7_branches`
  RENAME COLUMN `created_date` TO `src_created_at`,
  RENAME COLUMN `updated_date` TO `src_modified_at`,
  RENAME COLUMN `updated_at`   TO `modified_at`;

ALTER TABLE `cin7_branches`
  ADD INDEX `idx_cin7_branches_src_modified_at` (`src_modified_at`),
  ADD INDEX `idx_cin7_branches_synced_at`       (`synced_at`);
