CREATE TABLE `blocked_domains_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`blocked_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reason` text NOT NULL,
	`exact_match` integer NOT NULL,
	`parent_domain` text,
	`query_log_id` integer,
	FOREIGN KEY (`query_log_id`) REFERENCES `dns_query_logs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `blocked_domains_domain_idx` ON `blocked_domains_log` (`domain`);--> statement-breakpoint
CREATE INDEX `blocked_domains_blocked_at_idx` ON `blocked_domains_log` (`blocked_at`);--> statement-breakpoint
CREATE TABLE `blocklist_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text NOT NULL,
	`source` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocklist_entries_domain_unique` ON `blocklist_entries` (`domain`);--> statement-breakpoint
CREATE INDEX `blocklist_domain_idx` ON `blocklist_entries` (`domain`);--> statement-breakpoint
CREATE TABLE `dns_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`class` text DEFAULT 'IN',
	`ttl` integer NOT NULL,
	`data` text,
	FOREIGN KEY (`log_id`) REFERENCES `dns_query_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dns_answers_log_id_idx` ON `dns_answers` (`log_id`);--> statement-breakpoint
CREATE TABLE `dns_query_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query_id` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`client_ip` text,
	`query_type` text NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`processing_time_ms` integer
);
--> statement-breakpoint
CREATE INDEX `dns_logs_timestamp_idx` ON `dns_query_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `dns_logs_blocked_idx` ON `dns_query_logs` (`blocked`);--> statement-breakpoint
CREATE TABLE `dns_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`log_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`class` text DEFAULT 'IN' NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `dns_query_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dns_questions_log_id_idx` ON `dns_questions` (`log_id`);--> statement-breakpoint
CREATE INDEX `dns_questions_name_idx` ON `dns_questions` (`name`);--> statement-breakpoint
CREATE TABLE `system_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_stats_key_unique` ON `system_stats` (`key`);