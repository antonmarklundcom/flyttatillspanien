CREATE TABLE `agency_invites` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token` char(64) NOT NULL,
	`agency_id` bigint unsigned NOT NULL,
	`invited_by_user_id` bigint unsigned NOT NULL,
	`role` enum('agent','agency_admin') NOT NULL DEFAULT 'agent',
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`used_by_user_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `agency_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `agency_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `idx_agency_created` ON `agency_invites` (`agency_id`,`created_at`);