/*
  Warnings:

  - You are about to drop the column `cin7_id` on the `cin7_order_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `order_cin7_id` on the `cin7_order_line_items` table. All the data in the column will be lost.
  - You are about to drop the column `raw_data` on the `cin7_order_line_items` table. All the data in the column will be lost.
  - You are about to alter the column `error_message` on the `sync_logs` table. The data in that column could be lost. The data in that column will be cast from `VarChar(1000)` to `VarChar(500)`.
  - A unique constraint covering the columns `[cin7_line_item_id]` on the table `cin7_order_line_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cin7_line_item_id` to the `cin7_order_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `line_item_type` to the `cin7_order_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_id` to the `cin7_order_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sort_order` to the `cin7_order_line_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit_cost` to the `cin7_order_line_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `cin7_order_line_items_cin7_id_key` ON `cin7_order_line_items`;

-- DropIndex
DROP INDEX `cin7_order_line_items_order_cin7_id_idx` ON `cin7_order_line_items`;

-- DropIndex
DROP INDEX `cin7_orders_modified_date_idx` ON `cin7_orders`;

-- AlterTable cin7_order_line_items
ALTER TABLE `cin7_order_line_items` DROP COLUMN `cin7_id`,
    DROP COLUMN `order_cin7_id`,
    DROP COLUMN `raw_data`,
    ADD COLUMN `account_code` VARCHAR(50) NULL,
    ADD COLUMN `barcode` VARCHAR(100) NULL,
    ADD COLUMN `cin7_line_item_id` INTEGER NOT NULL,
    ADD COLUMN `comment` TEXT NULL,
    ADD COLUMN `line_item_type` VARCHAR(50) NOT NULL,
    ADD COLUMN `option1` VARCHAR(100) NULL,
    ADD COLUMN `option2` VARCHAR(100) NULL,
    ADD COLUMN `option3` VARCHAR(100) NULL,
    ADD COLUMN `order_id` INTEGER NOT NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL,
    ADD COLUMN `style_code` VARCHAR(100) NULL,
    ADD COLUMN `tax_rule` VARCHAR(100) NULL,
    ADD COLUMN `unit_cost` DECIMAL(12, 4) NOT NULL;

-- AlterTable sync_logs
ALTER TABLE `sync_logs` MODIFY `error_message` VARCHAR(500) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `cin7_order_line_items_cin7_line_item_id_key` ON `cin7_order_line_items`(`cin7_line_item_id`);

-- CreateIndex
CREATE INDEX `cin7_order_line_items_order_id_idx` ON `cin7_order_line_items`(`order_id`);

-- CreateIndex
CREATE INDEX `idx_cin7_orders_modified_date` ON `cin7_orders`(`modified_date`);
