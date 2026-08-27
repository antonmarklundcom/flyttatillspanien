-- Import batches + a per-agency scope on listing_sources.
--
-- Data consequence, deliberately not "fixed" by a backfill: every existing
-- listing_sources row gets scope_agency_id = 0, and its dedup_key was computed
-- with the old formula (no scope in the hash). New keys hash the scope in, so
-- an old key and a new key can never be equal — pre-existing rows are inert for
-- fuzzy dedup from here on. They still dedup by (source, 0, source_external_id)
-- for unscoped re-imports, which is how every import to date has run.
--
-- The thing to know: re-importing a file that was previously imported unscoped,
-- this time scoped to an agency, lands in a different id-space and will create
-- new listings rather than update the old ones. Guessing which agency the old
-- rows belonged to would be worse than saying this out loud.
CREATE TABLE `import_jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agency_id` bigint unsigned,
	`source` enum('manual','fsbo_ads','whiteglove','import_tulugar','import_infocasas','import_clasipar','import_agency_site','api') NOT NULL,
	`kind` enum('csv','xlsx','url','resync') NOT NULL,
	`filename` varchar(255),
	`status` enum('dry_run','committed','rolled_back','failed') NOT NULL,
	`total_rows` int NOT NULL DEFAULT 0,
	`created_count` int NOT NULL DEFAULT 0,
	`updated_count` int NOT NULL DEFAULT 0,
	`unchanged_count` int NOT NULL DEFAULT 0,
	`deduped_count` int NOT NULL DEFAULT 0,
	`skipped_count` int NOT NULL DEFAULT 0,
	`permission_granted` boolean NOT NULL DEFAULT false,
	`permission_granted_by` varchar(160),
	`permission_note` varchar(500),
	`permission_granted_at` datetime,
	`created_by_user_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`finished_at` datetime,
	`rolled_back_at` datetime,
	`rollback_note` varchar(500),
	CONSTRAINT `import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`job_id` bigint unsigned NOT NULL,
	`row_number` int NOT NULL,
	`outcome` enum('created','updated','unchanged','deduped','skipped','paused') NOT NULL,
	`listing_id` bigint unsigned,
	`title` varchar(200),
	`error` varchar(500),
	`previous_json` json,
	`reverted_at` datetime,
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `listing_sources` DROP INDEX `uq_source`;--> statement-breakpoint
ALTER TABLE `listing_sources` MODIFY COLUMN `dedup_key` char(40);--> statement-breakpoint
ALTER TABLE `listing_sources` ADD `scope_agency_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `listing_sources` ADD CONSTRAINT `uq_source` UNIQUE(`source`,`scope_agency_id`,`source_external_id`);--> statement-breakpoint
CREATE INDEX `idx_agency_created` ON `import_jobs` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `import_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_job` ON `import_rows` (`job_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `import_rows` (`listing_id`);