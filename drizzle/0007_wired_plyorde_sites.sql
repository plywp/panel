ALTER TABLE `wp_site` ADD `connector_id` int;
ALTER TABLE `wp_site` ADD `php_version` varchar(32);
ALTER TABLE `wp_site` ADD `status` varchar(32) NOT NULL DEFAULT 'provisioning';

ALTER TABLE `wp_site`
	ADD CONSTRAINT `wp_site_connector_id_connector_id_fk`
	FOREIGN KEY (`connector_id`) REFERENCES `connector`(`id`) ON DELETE set null ON UPDATE cascade;

CREATE INDEX `wp_site_connector_id_idx` ON `wp_site` (`connector_id`);
