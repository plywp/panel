ALTER TABLE `connector` ADD `data_base_username` varchar(191) DEFAULT 'plyorde' NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `data_base_password` text NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `data_base_host` varchar(191) DEFAULT 'localhost' NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `data_base_port` int DEFAULT 3306 NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `data_base_name` varchar(191) DEFAULT 'plyorde' NOT NULL;