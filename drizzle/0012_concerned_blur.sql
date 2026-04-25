ALTER TABLE `apikey` DROP FOREIGN KEY `apikey_user_id_user_id_fk`;
--> statement-breakpoint
ALTER TABLE `apikey` DROP FOREIGN KEY `apikey_organization_id_organization_id_fk`;
--> statement-breakpoint
DROP INDEX `apikey_userId_idx` ON `apikey`;--> statement-breakpoint
DROP INDEX `apikey_organizationId_idx` ON `apikey`;--> statement-breakpoint
ALTER TABLE `account` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `session` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `created_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` ADD `config_id` varchar(255) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` ADD `reference_id` varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
ALTER TABLE `apikey` DROP COLUMN `user_id`;--> statement-breakpoint
ALTER TABLE `apikey` DROP COLUMN `organization_id`;