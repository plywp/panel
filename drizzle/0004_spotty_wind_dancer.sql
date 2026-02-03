CREATE TABLE `invitation` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` varchar(255),
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`inviter_id` varchar(36) NOT NULL,
	CONSTRAINT `invitation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` varchar(255) NOT NULL DEFAULT 'member',
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `member_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`logo` text,
	`created_at` timestamp(3) NOT NULL,
	`metadata` text,
	CONSTRAINT `organization_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `organization_slug_uidx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `wp_site` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`internal_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`domain` varchar(255) NOT NULL,
	`docroot` varchar(1024) NOT NULL,
	`disk_limit_mb` int NOT NULL,
	`suspended` boolean NOT NULL DEFAULT false,
	`db_host` varchar(255) NOT NULL DEFAULT '127.0.0.1',
	`db_name` varchar(255) NOT NULL,
	`db_user` varchar(255) NOT NULL,
	`db_password` varchar(255) NOT NULL,
	`table_prefix` varchar(32) NOT NULL DEFAULT 'wp_',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `wp_site_id` PRIMARY KEY(`id`),
	CONSTRAINT `wp_site_internal_uq` UNIQUE(`internal_id`),
	CONSTRAINT `wp_site_domain_uq` UNIQUE(`domain`)
);
--> statement-breakpoint
ALTER TABLE `session` ADD `active_organization_id` text;--> statement-breakpoint
ALTER TABLE `key_store` ADD CONSTRAINT `key_store_key_unique` UNIQUE(`key`);--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `wp_site_org_idx` ON `wp_site` (`organization_id`);