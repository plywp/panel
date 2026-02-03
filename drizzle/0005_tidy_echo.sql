ALTER TABLE `wp_site` DROP INDEX `wp_site_internal_uq`;--> statement-breakpoint
ALTER TABLE `wp_site` DROP INDEX `wp_site_domain_uq`;--> statement-breakpoint
DROP INDEX `wp_site_org_idx` ON `wp_site`;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `internal_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `domain` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `docroot` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `disk_limit_mb` int NOT NULL DEFAULT 1024;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `db_host` text NOT NULL DEFAULT ('127.0.0.1');--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `db_name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `db_user` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `db_password` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` MODIFY COLUMN `table_prefix` text NOT NULL DEFAULT ('wp_');--> statement-breakpoint
ALTER TABLE `organization` ADD `services` varchar(36);--> statement-breakpoint
ALTER TABLE `organization` ADD CONSTRAINT `organization_services_wp_site_id_fk` FOREIGN KEY (`services`) REFERENCES `wp_site`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wp_site` ADD CONSTRAINT `wp_site_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wp_site` DROP COLUMN `suspended`;--> statement-breakpoint
ALTER TABLE `wp_site` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `wp_site` DROP COLUMN `updated_at`;