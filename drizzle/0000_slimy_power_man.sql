CREATE TABLE `agencies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`logo_url` varchar(500),
	`whatsapp` varchar(30),
	`email` varchar(190),
	`is_verified` boolean NOT NULL DEFAULT false,
	`plan` enum('free','destacado','partner') NOT NULL DEFAULT 'free',
	`ghl_sub_account_id` varchar(80),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `agencies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agency_id` bigint unsigned,
	`user_id` bigint unsigned,
	`name` varchar(140) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`photo_url` varchar(500),
	`whatsapp` varchar(30),
	`is_verified` boolean NOT NULL DEFAULT false,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `developers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`logo_url` varchar(500),
	`website` varchar(300),
	`whatsapp` varchar(30),
	CONSTRAINT `developers_id` PRIMARY KEY(`id`),
	CONSTRAINT `developers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `financing_programs` (
	`code` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`annual_rate` decimal(5,2) NOT NULL,
	`max_term_months` smallint NOT NULL,
	`max_amount_gs` decimal(14,0),
	`min_down_pct` decimal(5,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updated_at` datetime,
	CONSTRAINT `financing_programs_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`lead_type` enum('buyer','renter','seller','valuation','developer','agent_signup') NOT NULL,
	`vertical` varchar(40) NOT NULL,
	`listing_id` bigint unsigned,
	`project_id` bigint unsigned,
	`name` varchar(140),
	`whatsapp` varchar(30) NOT NULL,
	`email` varchar(190),
	`message` text,
	`utm` json,
	`routed_to` enum('agency','agent','internal','developer') NOT NULL,
	`ghl_contact_id` varchar(80),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listing_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`r2_key` varchar(500) NOT NULL,
	`position` tinyint unsigned NOT NULL DEFAULT 0,
	`width` int unsigned,
	`height` int unsigned,
	`watermark_score` tinyint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `listing_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listing_sources` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`source` enum('manual','fsbo_ads','whiteglove','import_tulugar','import_infocasas','import_clasipar','import_agency_site','api') NOT NULL,
	`source_url` varchar(600),
	`source_external_id` varchar(120),
	`content_hash` char(40) NOT NULL,
	`dedup_key` char(40) NOT NULL,
	`first_seen_at` datetime NOT NULL,
	`last_seen_at` datetime NOT NULL,
	CONSTRAINT `listing_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_source` UNIQUE(`source`,`source_external_id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` char(10) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`operation` enum('venta','alquiler','alquiler_temporal') NOT NULL,
	`property_type` enum('casa','departamento','terreno','duplex','comercial','oficina','deposito','quinta') NOT NULL,
	`status` enum('draft','pending_review','published','paused','sold','rented','removed') NOT NULL DEFAULT 'draft',
	`title` varchar(180) NOT NULL,
	`description_es` text,
	`description_en` text,
	`price_amount` decimal(14,2) NOT NULL,
	`price_currency` enum('USD','PYG') NOT NULL,
	`price_usd` decimal(12,2) NOT NULL,
	`cuota_gs` decimal(14,0),
	`bedrooms` tinyint unsigned,
	`bathrooms` tinyint unsigned,
	`parking` tinyint unsigned,
	`area_m2` decimal(10,2),
	`land_m2` decimal(12,2),
	`property_state` enum('entrega_inmediata','en_construccion','en_pozo','usado'),
	`amenities` json,
	`location_id` bigint unsigned NOT NULL,
	`address_text` varchar(255),
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`agency_id` bigint unsigned,
	`agent_id` bigint unsigned,
	`project_id` bigint unsigned,
	`owner_user_id` bigint unsigned,
	`is_verified` boolean NOT NULL DEFAULT false,
	`verified_at` datetime,
	`featured_until` datetime,
	`foreign_exposure` boolean NOT NULL DEFAULT true,
	`video_url` varchar(500),
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_public_id_unique` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`level` enum('pais','departamento','ciudad','barrio') NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`full_slug` varchar(300) NOT NULL,
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`listing_counts` json,
	`guide_content_es` mediumtext,
	`guide_content_en` mediumtext,
	`guide_updated_at` datetime,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_full_slug_unique` UNIQUE(`full_slug`)
);
--> statement-breakpoint
CREATE TABLE `market_medians` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`period` char(7) NOT NULL,
	`location_id` bigint unsigned NOT NULL,
	`property_type` varchar(20) NOT NULL,
	`operation` varchar(20) NOT NULL,
	`median_price_usd` decimal(12,2),
	`median_price_m2_usd` decimal(10,2),
	`sample_size` int unsigned NOT NULL,
	`source` enum('own','blended') NOT NULL,
	CONSTRAINT `market_medians_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq` UNIQUE(`period`,`location_id`,`property_type`,`operation`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`whatsapp` varchar(30) NOT NULL,
	`code` char(6) NOT NULL,
	`expires_at` datetime NOT NULL,
	`attempts` tinyint NOT NULL DEFAULT 0,
	`consumed_at` datetime,
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`developer_id` bigint unsigned,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`project_type` enum('edificio','loteamiento','condominio','barrio_cerrado') NOT NULL,
	`location_id` bigint unsigned NOT NULL,
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`stage` enum('en_pozo','en_construccion','entrega_inmediata'),
	`delivery_date` date,
	`description_es` text,
	`hero_image_url` varchar(500),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(140),
	`email` varchar(190),
	`whatsapp` varchar(30),
	`whatsapp_verified_at` datetime,
	`role` enum('consumer','agent','agency_admin','developer','admin') NOT NULL DEFAULT 'consumer',
	`locale` enum('es','en') NOT NULL DEFAULT 'es',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_whatsapp_unique` UNIQUE(`whatsapp`)
);
--> statement-breakpoint
CREATE INDEX `idx_agency` ON `agents` (`agency_id`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `leads` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `leads` (`lead_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `listing_images` (`listing_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_dedup` ON `listing_sources` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `listing_sources` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_search` ON `listings` (`status`,`operation`,`property_type`,`location_id`,`price_usd`);--> statement-breakpoint
CREATE INDEX `idx_location` ON `listings` (`location_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_geo` ON `listings` (`status`,`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `idx_agency` ON `listings` (`agency_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_project` ON `listings` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_fresh` ON `listings` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_parent` ON `locations` (`parent_id`,`level`);--> statement-breakpoint
CREATE INDEX `idx_wa` ON `otp_codes` (`whatsapp`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_loc` ON `projects` (`location_id`);