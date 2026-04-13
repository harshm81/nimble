-- Add missing is_active index to cin7_inventory.
-- All other filterable boolean columns across cin7 tables are indexed.
-- cin7_inventory.is_active was the only one missing.

CREATE INDEX `cin7_inventory_is_active_idx` ON `cin7_inventory`(`is_active`);
