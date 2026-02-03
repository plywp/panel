ALTER TABLE `organization` RENAME COLUMN `services` TO `wp_sites`;--> statement-breakpoint
ALTER TABLE `organization` DROP FOREIGN KEY `organization_services_wp_site_id_fk`;
--> statement-breakpoint
ALTER TABLE `organization` ADD CONSTRAINT `organization_wp_sites_wp_site_id_fk` FOREIGN KEY (`wp_sites`) REFERENCES `wp_site`(`id`) ON DELETE cascade ON UPDATE no action;