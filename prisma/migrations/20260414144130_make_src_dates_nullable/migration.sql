-- AlterTable
ALTER TABLE `cin7_branches` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_contacts` MODIFY `member_since` DATETIME(3) NULL,
    MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_credit_notes` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_orders` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_products` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_purchase_orders` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `cin7_stock_adjustments` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `facebook_ads` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `facebook_adsets` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `facebook_campaigns` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_customers` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_inventory` MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_product_variants` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_products` MODIFY `src_created_at` DATETIME(3) NULL,
    MODIFY `src_modified_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shopify_refunds` MODIFY `refunded_at` DATETIME(3) NULL;
