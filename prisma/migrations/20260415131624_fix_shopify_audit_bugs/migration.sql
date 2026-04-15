/*
  Warnings:

  - You are about to alter the column `available` on the `shopify_inventory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(12,4)`.
  - You are about to alter the column `inventory_quantity` on the `shopify_product_variants` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE `shopify_cart_events` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_inventory` MODIFY `available` DECIMAL(12, 4) NULL;

-- AlterTable
ALTER TABLE `shopify_order_line_items` MODIFY `quantity` INTEGER NULL;

-- AlterTable
ALTER TABLE `shopify_product_variants` MODIFY `inventory_quantity` DECIMAL(12, 4) NULL;

-- AlterTable
ALTER TABLE `shopify_products` MODIFY `title` VARCHAR(255) NULL,
    MODIFY `status` VARCHAR(50) NULL;
