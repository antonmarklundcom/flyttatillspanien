CREATE TABLE `acquisition_costs` (
	`region` char(2) NOT NULL,
	`name` varchar(80) NOT NULL,
	`itp_pct` decimal(5,2) NOT NULL,
	`iva_pct` decimal(5,2) NOT NULL DEFAULT '10.00',
	`ajd_pct` decimal(5,2) NOT NULL,
	`notary_pct_est` decimal(5,2) NOT NULL,
	`registry_pct_est` decimal(5,2) NOT NULL,
	`legal_pct_est` decimal(5,2) NOT NULL,
	`effective_from` date NOT NULL,
	`source_url` varchar(400),
	`active` boolean NOT NULL DEFAULT true,
	`updated_at` datetime,
	CONSTRAINT `acquisition_costs_region` PRIMARY KEY(`region`)
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`logo_url` varchar(500),
	`kind` enum('inmobiliaria','relocation','developer') NOT NULL DEFAULT 'inmobiliaria',
	`country_code` char(2) NOT NULL DEFAULT 'ES',
	`tax_id` varchar(20),
	`tax_id_country` char(2),
	`registry_number` varchar(40),
	`phone` varchar(30),
	`email` varchar(190),
	`is_verified` boolean NOT NULL DEFAULT false,
	`plan` enum('free','premium','partner') NOT NULL DEFAULT 'free',
	`ghl_sub_account_id` varchar(80),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `agencies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
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
CREATE TABLE `agents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agency_id` bigint unsigned,
	`user_id` bigint unsigned,
	`name` varchar(140) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`photo_url` varchar(500),
	`phone` varchar(30),
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
CREATE TABLE `fx_rates` (
	`base` char(3) NOT NULL,
	`quote` char(3) NOT NULL,
	`rate` decimal(12,6) NOT NULL,
	`observed_on` date NOT NULL,
	`source` enum('ecb','manual') NOT NULL DEFAULT 'ecb',
	`fetched_at` datetime NOT NULL,
	CONSTRAINT `fx_rates_base_quote_pk` PRIMARY KEY(`base`,`quote`)
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agency_id` bigint unsigned,
	`source` enum('manual','fsbo_ads','whiteglove','import_idealista','import_fotocasa','import_kyero','import_agency_site','api') NOT NULL,
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
CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`lead_type` enum('buyer','renter','seller','valuation','developer','agent_signup') NOT NULL,
	`vertical` varchar(40) NOT NULL,
	`listing_id` bigint unsigned,
	`project_id` bigint unsigned,
	`name` varchar(140),
	`email` varchar(190) NOT NULL,
	`phone` varchar(30),
	`message` text,
	`utm` json,
	`routed_to` enum('agency','agent','internal','developer','owner') NOT NULL,
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
	`source` enum('manual','fsbo_ads','whiteglove','import_idealista','import_fotocasa','import_kyero','import_agency_site','api') NOT NULL,
	`scope_agency_id` bigint unsigned NOT NULL DEFAULT 0,
	`source_url` varchar(600),
	`source_external_id` varchar(120),
	`content_hash` char(40) NOT NULL,
	`dedup_key` char(40),
	`first_seen_at` datetime NOT NULL,
	`last_seen_at` datetime NOT NULL,
	CONSTRAINT `listing_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_source` UNIQUE(`source`,`scope_agency_id`,`source_external_id`)
);
--> statement-breakpoint
CREATE TABLE `listing_views_daily` (
	`listing_id` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`views` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `listing_views_daily_listing_id_day_pk` PRIMARY KEY(`listing_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` char(10) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`operation` enum('venta','alquiler','alquiler_vacacional') NOT NULL,
	`property_type` enum('villa','apartamento','atico','adosado','duplex','finca','terreno','local') NOT NULL,
	`status` enum('draft','pending_review','published','paused','sold','rented','removed') NOT NULL DEFAULT 'draft',
	`source_lang` enum('es','sv') NOT NULL DEFAULT 'es',
	`title` varchar(180) NOT NULL,
	`description_es` text,
	`title_sv` varchar(180),
	`description_sv` text,
	`translation_hash_sv` char(64),
	`price_eur` decimal(12,2) NOT NULL,
	`bedrooms` tinyint unsigned,
	`bathrooms` tinyint unsigned,
	`parking` tinyint unsigned,
	`built_m2` decimal(10,2),
	`usable_m2` decimal(10,2),
	`plot_m2` decimal(12,2),
	`year_built` smallint unsigned,
	`property_state` enum('obra_nueva','sobre_plano','en_construccion','segunda_mano'),
	`amenities` json,
	`referencia_catastral` char(20),
	`energy_rating` enum('A','B','C','D','E','F','G','en_tramite','exento'),
	`energy_emissions` enum('A','B','C','D','E','F','G'),
	`energy_kwh_m2` decimal(7,2),
	`energy_co2_m2` decimal(7,2),
	`legal_status` enum('escritura_registrada','obra_nueva_lpo','sin_lpo','en_regularizacion','desconocido') NOT NULL DEFAULT 'desconocido',
	`charges_status` enum('libre_de_cargas','con_hipoteca','con_cargas','desconocido') NOT NULL DEFAULT 'desconocido',
	`nota_simple_seen_at` datetime,
	`ibi_annual_eur` decimal(9,2),
	`community_monthly_eur` decimal(9,2),
	`is_vpo` boolean NOT NULL DEFAULT false,
	`land_classification` enum('urbano','urbanizable','rustico'),
	`buildable_m2` decimal(12,2),
	`tourist_licence` varchar(40),
	`location_id` bigint unsigned NOT NULL,
	`address_text` varchar(255),
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`display_lat` decimal(9,6),
	`display_lng` decimal(9,6),
	`agency_id` bigint unsigned,
	`agent_id` bigint unsigned,
	`project_id` bigint unsigned,
	`owner_user_id` bigint unsigned,
	`is_verified` boolean NOT NULL DEFAULT false,
	`verified_at` datetime,
	`review_notes` varchar(280),
	`featured_until` datetime,
	`video_url` varchar(500),
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `uq_catastral` UNIQUE(`referencia_catastral`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`level` enum('pais','comunidad','provincia','municipio','zona') NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`full_slug` varchar(300) NOT NULL,
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`listing_counts` json,
	`acquisition_region` char(2),
	`guide_content_sv` mediumtext,
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
	`median_price_eur` decimal(12,2),
	`median_price_m2_eur` decimal(10,2),
	`sample_size` int unsigned NOT NULL,
	`sample_size_m2` int unsigned NOT NULL DEFAULT 0,
	`source` enum('own','blended') NOT NULL,
	CONSTRAINT `market_medians_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq` UNIQUE(`period`,`location_id`,`property_type`,`operation`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`destination` varchar(190) NOT NULL,
	`channel` enum('email','sms') NOT NULL DEFAULT 'email',
	`code` char(6) NOT NULL,
	`expires_at` datetime NOT NULL,
	`attempts` tinyint NOT NULL DEFAULT 0,
	`consumed_at` datetime,
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `projects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`developer_id` bigint unsigned,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`project_type` enum('edificio','urbanizacion','condominio','barrio_cerrado') NOT NULL,
	`location_id` bigint unsigned NOT NULL,
	`lat` decimal(9,6),
	`lng` decimal(9,6),
	`stage` enum('sobre_plano','en_construccion','obra_nueva'),
	`delivery_date` date,
	`description_es` text,
	`hero_image_url` varchar(500),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(140),
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255),
	`phone` varchar(30),
	`email_verified_at` datetime,
	`role` enum('consumer','agent','agency_admin','developer','admin') NOT NULL DEFAULT 'consumer',
	`locale` enum('sv','en','es') NOT NULL DEFAULT 'sv',
	`identity_doc_type` enum('nie','dni','passport','personnummer'),
	`identity_ref_last4` char(4),
	`identity_verified_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE INDEX `idx_agency_created` ON `agency_invites` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agency` ON `agents` (`agency_id`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `agents` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_agency_created` ON `import_jobs` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `import_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_job` ON `import_rows` (`job_id`,`row_number`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `import_rows` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `leads` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `leads` (`lead_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `listing_images` (`listing_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_dedup` ON `listing_sources` (`dedup_key`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `listing_sources` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_search` ON `listings` (`status`,`operation`,`location_id`,`property_type`,`price_eur`);--> statement-breakpoint
CREATE INDEX `idx_recent` ON `listings` (`status`,`operation`,`location_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_location` ON `listings` (`location_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_geo` ON `listings` (`status`,`display_lat`,`display_lng`);--> statement-breakpoint
CREATE INDEX `idx_agency` ON `listings` (`agency_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_project` ON `listings` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_fresh` ON `listings` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_home_row` ON `listings` (`status`,`operation`,`property_type`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_parent` ON `locations` (`parent_id`,`level`);--> statement-breakpoint
CREATE INDEX `idx_slug` ON `locations` (`slug`,`level`);--> statement-breakpoint
CREATE INDEX `idx_dest` ON `otp_codes` (`destination`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_status_published` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_category` ON `posts` (`category`,`status`);--> statement-breakpoint
CREATE INDEX `idx_loc` ON `projects` (`location_id`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_expires` ON `sessions` (`expires_at`);