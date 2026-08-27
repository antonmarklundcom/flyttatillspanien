CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `review_notes` varchar(280);--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `agents` (`user_id`);