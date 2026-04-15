/*
  Warnings:

  - You are about to drop the column `interval_minutes` on the `sync_config` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shopify_cart_id,event_type]` on the table `shopify_cart_events` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `shopify_cart_events_shopify_cart_id_key` ON `shopify_cart_events`;

-- AlterTable
ALTER TABLE `sync_config` DROP COLUMN `interval_minutes`;

-- CreateIndex
CREATE INDEX `idx_shopify_cart_events_cart_id` ON `shopify_cart_events`(`shopify_cart_id`);

-- CreateIndex
CREATE UNIQUE INDEX `shopify_cart_events_shopify_cart_id_event_type_key` ON `shopify_cart_events`(`shopify_cart_id`, `event_type`);
