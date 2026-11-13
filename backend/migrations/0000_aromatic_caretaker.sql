CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`details_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_admin_idx` ON `admin_audit` (`admin_id`);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `devices` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`machine_guid` text,
	`signals_json` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`abuse_score` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`system_id` text NOT NULL,
	`title` text NOT NULL,
	`r2_key` text NOT NULL,
	`rom_filename` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`trial_eligible` integer DEFAULT false NOT NULL,
	`free_from` integer,
	`free_until` integer,
	FOREIGN KEY (`system_id`) REFERENCES `systems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `games_system_idx` ON `games` (`system_id`);--> statement-breakpoint
CREATE TABLE `play_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_sec` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `play_events_game_idx` ON `play_events` (`game_id`);--> statement-breakpoint
CREATE INDEX `play_events_user_idx` ON `play_events` (`user_id`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`provider_ref` text,
	`started_at` integer NOT NULL,
	`current_period_end` integer,
	`canceled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `systems` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`retrobat_folder` text NOT NULL,
	`default_core` text,
	`extensions` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_fingerprint` text NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_fingerprint`) REFERENCES `devices`(`fingerprint`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trials_device_unique` ON `trials` (`device_fingerprint`);--> statement-breakpoint
CREATE INDEX `trials_user_idx` ON `trials` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`abuse_score` integer DEFAULT 0 NOT NULL,
	`under_review` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);