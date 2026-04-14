/*
  Warnings:

  - Added the required column `view_item_events` to the `ga4_ecommerce_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `item_list_clicks` to the `ga4_product_data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `item_list_views` to the `ga4_product_data` table without a default value. This is not possible if the table is not empty.
  - Made the column `item_id` on table `ga4_product_data` required. This step will fail if there are existing NULL values in that column.
  - Made the column `item_name` on table `ga4_product_data` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `ga4_ecommerce_events` ADD COLUMN `view_item_events` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ga4_product_data` ADD COLUMN `item_list_clicks` INTEGER NOT NULL,
    ADD COLUMN `item_list_views` INTEGER NOT NULL,
    MODIFY `item_id` VARCHAR(100) NOT NULL,
    MODIFY `item_name` VARCHAR(255) NOT NULL;
