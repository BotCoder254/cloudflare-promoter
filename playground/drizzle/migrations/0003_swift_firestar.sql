CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`event_type` text NOT NULL,
	`owner_id` text,
	`link_id` text,
	`slug` text,
	`ip_hash` text,
	`country` text,
	`user_agent` text,
	`referrer` text,
	`request_path` text,
	`metadata` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `security_events_created_at_idx` ON `security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_type_idx` ON `security_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `security_events_owner_idx` ON `security_events` (`owner_id`);--> statement-breakpoint
CREATE INDEX `security_events_link_idx` ON `security_events` (`link_id`);--> statement-breakpoint
CREATE INDEX `security_events_ip_hash_idx` ON `security_events` (`ip_hash`);--> statement-breakpoint
CREATE INDEX `visits_unique_probe_idx` ON `visits` (`link_id`,`visit_day`,`ip_hash`);