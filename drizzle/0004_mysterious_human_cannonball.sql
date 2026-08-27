CREATE TABLE `posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(200) NOT NULL,
	`excerpt` varchar(400),
	`body` mediumtext NOT NULL,
	`cover_r2_key` varchar(500),
	`category` enum('guia','mercado','noticia') NOT NULL DEFAULT 'guia',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`author_user_id` bigint unsigned,
	`published_at` datetime,
	`updated_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_status_published` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_category` ON `posts` (`category`,`status`);