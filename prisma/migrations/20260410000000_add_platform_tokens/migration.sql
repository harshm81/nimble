-- CreateTable
CREATE TABLE `platform_tokens` (
    `platform` VARCHAR(191) NOT NULL,
    `access_token` LONGTEXT NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`platform`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
