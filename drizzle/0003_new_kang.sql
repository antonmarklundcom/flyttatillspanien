CREATE TABLE `listing_views_daily` (
	`listing_id` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`views` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `listing_views_daily_listing_id_day_pk` PRIMARY KEY(`listing_id`,`day`)
);
--> statement-breakpoint
CREATE INDEX `idx_listing_day` ON `listing_views_daily` (`listing_id`,`day`);