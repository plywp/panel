CREATE TABLE `key_store` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	CONSTRAINT `key_store_id` PRIMARY KEY(`id`)
);
