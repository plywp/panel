ALTER TABLE `connector` ADD `ssl_issuer_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_mode` varchar(32);--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_email` varchar(191);--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_ca_dir_url` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_accept_tos` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_key_type` varchar(32);--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_account_dir` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_include_www` varchar(16);--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_renew_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_renew_interval_hours` int;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_cert_path` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_key_path` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_webroot_path` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_timeout_seconds` int;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_expected_ips` text;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_verify_dns` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `connector` ADD `ssl_issuer_verify_http` boolean DEFAULT true NOT NULL;