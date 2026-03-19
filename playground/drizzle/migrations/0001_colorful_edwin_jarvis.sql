CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`visit_day` text NOT NULL,
	`visited_at` text NOT NULL,
	`referrer` text,
	`user_agent` text,
	`country` text,
	`ip_hash` text,
	`is_unique` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `visits_link_idx` ON `visits` (`link_id`);--> statement-breakpoint
CREATE INDEX `visits_owner_idx` ON `visits` (`owner_id`);--> statement-breakpoint
CREATE INDEX `visits_day_idx` ON `visits` (`visit_day`);--> statement-breakpoint
CREATE INDEX `visits_timestamp_idx` ON `visits` (`visited_at`);--> statement-breakpoint
ALTER TABLE `daily_stats` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_stats` ADD `updated_at` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_stats_link_date_unique` ON `daily_stats` (`link_id`,`date`);--> statement-breakpoint
CREATE INDEX `daily_stats_date_idx` ON `daily_stats` (`date`);--> statement-breakpoint
ALTER TABLE `links` ADD `is_private` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `requires_password` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `links` ADD `one_time` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `links` ADD `unique_clicks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `links` ADD `last_visited_at` text;--> statement-breakpoint
ALTER TABLE `links` ADD `qr_code_url` text;--> statement-breakpoint
ALTER TABLE `links` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `links_owner_idx` ON `links` (`owner_id`);--> statement-breakpoint
CREATE INDEX `links_owner_status_idx` ON `links` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `links_archived_idx` ON `links` (`archived_at`);--> statement-breakpoint
CREATE INDEX `links_expires_idx` ON `links` (`expires_at`);