/*
  Warnings:

  - You are about to drop the column `campaign_id` on the `klaviyo_events` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `idx_klaviyo_events_campaign_id` ON `klaviyo_events`;

-- AlterTable
ALTER TABLE `klaviyo_events` DROP COLUMN `campaign_id`,
    ADD COLUMN `message_id` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `idx_klaviyo_events_message_id` ON `klaviyo_events`(`message_id`);
