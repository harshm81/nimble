-- AlterTable
ALTER TABLE `klaviyo_events` ADD COLUMN `campaign_id` VARCHAR(50) NULL,
    ADD COLUMN `metric_name` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `idx_klaviyo_events_metric_name` ON `klaviyo_events`(`metric_name`);

-- CreateIndex
CREATE INDEX `idx_klaviyo_events_campaign_id` ON `klaviyo_events`(`campaign_id`);
