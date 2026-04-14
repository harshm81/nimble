/*
  Warnings:

  - You are about to drop the column `modified_date` on the `cin7_orders` table. All the data in the column will be lost.
  - You are about to drop the column `order_date` on the `cin7_orders` table. All the data in the column will be lost.
  - Added the required column `src_created_at` to the `cin7_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `src_modified_at` to the `cin7_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `cin7_orders_order_date_idx` ON `cin7_orders`;

-- DropIndex
DROP INDEX `idx_cin7_orders_modified_date` ON `cin7_orders`;

-- AlterTable
ALTER TABLE `cin7_orders` DROP COLUMN `modified_date`,
    DROP COLUMN `order_date`,
    ADD COLUMN `src_created_at` DATETIME(3) NOT NULL,
    ADD COLUMN `src_modified_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `shopify_orders` ADD COLUMN `src_created_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `idx_cin7_orders_src_modified_at` ON `cin7_orders`(`src_modified_at`);
