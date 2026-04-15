/*
  Warnings:

  - You are about to drop the column `view_item_events` on the `ga4_ecommerce_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ga4_ecommerce_events` DROP COLUMN `view_item_events`;

-- AlterTable
ALTER TABLE `ga4_sessions` ADD COLUMN `new_vs_returning` VARCHAR(20) NULL;
