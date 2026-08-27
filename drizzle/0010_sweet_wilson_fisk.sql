DROP INDEX `idx_geo` ON `listings`;--> statement-breakpoint
ALTER TABLE `listings` ADD `display_lat` decimal(9,6);--> statement-breakpoint
ALTER TABLE `listings` ADD `display_lng` decimal(9,6);--> statement-breakpoint
-- Backfill, hand-added to the generated file: drizzle-kit emits DDL only, and
-- a display coordinate that is NULL on every existing row is an empty map.
-- Same expression as src/lib/geo.ts (syncStatement) and `npm run cron:geo`, so
-- the three cannot drift. Idempotent, and it deliberately does not touch
-- `updated_at` — the column has no ON UPDATE clause, so a recomputation
-- nobody can see does not move a listing's sitemap lastmod.
UPDATE `listings`
  JOIN `locations` ON `locations`.`id` = `listings`.`location_id`
   SET `listings`.`display_lat` = coalesce(`listings`.`lat`, `locations`.`lat`),
       `listings`.`display_lng` = coalesce(`listings`.`lng`, `locations`.`lng`);--> statement-breakpoint
CREATE INDEX `idx_geo` ON `listings` (`status`,`display_lat`,`display_lng`);
