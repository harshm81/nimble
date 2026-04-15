-- AlterTable
ALTER TABLE `cin7_inventory` ADD COLUMN `cbm` DECIMAL(10, 4) NULL,
    ADD COLUMN `depth` DECIMAL(10, 4) NULL,
    ADD COLUMN `height` DECIMAL(10, 4) NULL,
    ADD COLUMN `weight` DECIMAL(10, 4) NULL,
    ADD COLUMN `width` DECIMAL(10, 4) NULL;

-- AlterTable
ALTER TABLE `cin7_products` ADD COLUMN `unit_price_tier10` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier2` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier3` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier4` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier5` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier6` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier7` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier8` DECIMAL(12, 4) NULL,
    ADD COLUMN `unit_price_tier9` DECIMAL(12, 4) NULL;
