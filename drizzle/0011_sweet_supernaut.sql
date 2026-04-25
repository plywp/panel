ALTER TABLE `apikey` ADD `organization_id` varchar(36);--> statement-breakpoint
ALTER TABLE `apikey` ADD CONSTRAINT `apikey_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `apikey_organizationId_idx` ON `apikey` (`organization_id`);