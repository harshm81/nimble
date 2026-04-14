-- Manual column reorders applied directly in DB — recorded here so Prisma history stays in sync.
-- ga4_product_data final order:  ... purchases, revenue, item_list_views, item_list_clicks, raw_data ...
-- ga4_ecommerce_events final order: ... checkouts, view_item_events, raw_data ...

ALTER TABLE `ga4_product_data`
  MODIFY COLUMN `item_list_views`  INT NOT NULL AFTER `revenue`,
  MODIFY COLUMN `item_list_clicks` INT NOT NULL AFTER `item_list_views`;

ALTER TABLE `ga4_ecommerce_events`
  MODIFY COLUMN `view_item_events` INT NOT NULL AFTER `checkouts`;
