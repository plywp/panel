CREATE TABLE `connector` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` text NOT NULL,
	`daemon_ssl_enabled` boolean NOT NULL DEFAULT false,
	`daemon_ssl_crt` text,
	`daemon_ssl_key` text,
	`data_dir` text NOT NULL,
	`web_server` text NOT NULL,
	`auto_ssl` boolean NOT NULL DEFAULT false,
	`dns_server_address` text NOT NULL,
	`dns_server_port` int NOT NULL DEFAULT 53,
	`dns_server_proto` enum('tcp','udp','both') NOT NULL DEFAULT 'tcp',
	`server_ip` varchar(191) NOT NULL,
	`location_id` int NOT NULL,
	CONSTRAINT `connector_id` PRIMARY KEY(`id`),
	CONSTRAINT `connector_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `location` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`country` varchar(191) NOT NULL,
	CONSTRAINT `location_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `connector` ADD CONSTRAINT `connector_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `connector_location_id_idx` ON `connector` (`location_id`);