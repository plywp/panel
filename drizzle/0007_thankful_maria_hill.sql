CREATE TABLE `apikey` (
	`id` varchar(36) NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`refill_interval` int,
	`refill_amount` int,
	`last_refill_at` timestamp(3),
	`enabled` boolean DEFAULT true,
	`rate_limit_enabled` boolean DEFAULT true,
	`rate_limit_time_window` int DEFAULT 86400000,
	`rate_limit_max` int DEFAULT 10,
	`request_count` int DEFAULT 0,
	`remaining` int,
	`last_request` timestamp(3),
	`expires_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`permissions` text,
	`metadata` text,
	CONSTRAINT `apikey_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `wp_site` ADD `connector_id` int;--> statement-breakpoint
ALTER TABLE `wp_site` ADD `admin_username` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` ADD `admin_password` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` ADD `admin_email` text NOT NULL;--> statement-breakpoint
ALTER TABLE `wp_site` ADD `php_version` text;--> statement-breakpoint
ALTER TABLE `wp_site` ADD `status` text DEFAULT ('provisioning') NOT NULL;--> statement-breakpoint
ALTER TABLE `apikey` ADD CONSTRAINT `apikey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_userId_idx` ON `apikey` (`user_id`);