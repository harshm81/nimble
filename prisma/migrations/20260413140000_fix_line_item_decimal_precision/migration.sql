-- Fix decimal precision on cin7_order_line_items.
--
-- Findings from Cin7 Core API docs:
--   unit_price  — can have up to 7dp internally; DECIMAL(12,4) is correct (keep)
--   discount    — is a PERCENTAGE (0–100), 2dp only; was DECIMAL(12,4), fix to DECIMAL(8,2)
--   tax         — is a money amount, 2dp; was DECIMAL(12,4), fix to DECIMAL(12,2)
--   total       — is a money amount, 2dp; was DECIMAL(12,4), fix to DECIMAL(12,2)
--
-- Product/inventory unit_price and cost_price stay at DECIMAL(12,4) — prices can have 4dp.
-- No data loss — MODIFY COLUMN on DECIMAL only changes storage precision, existing values are preserved.

ALTER TABLE `cin7_order_line_items`
  MODIFY COLUMN `discount` DECIMAL(8,  2) NOT NULL,
  MODIFY COLUMN `tax`      DECIMAL(12, 2) NOT NULL,
  MODIFY COLUMN `total`    DECIMAL(12, 2) NOT NULL;
