DROP INDEX `idx_search` ON `listings`;--> statement-breakpoint
CREATE INDEX `idx_recent` ON `listings` (`status`,`operation`,`location_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_search` ON `listings` (`status`,`operation`,`location_id`,`property_type`,`price_usd`);