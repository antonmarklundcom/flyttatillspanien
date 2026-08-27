DROP INDEX `idx_listing_day` ON `listing_views_daily`;--> statement-breakpoint
CREATE INDEX `idx_created` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_home_row` ON `listings` (`status`,`operation`,`property_type`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_slug` ON `locations` (`slug`,`level`);--> statement-breakpoint
CREATE INDEX `idx_expires` ON `sessions` (`expires_at`);