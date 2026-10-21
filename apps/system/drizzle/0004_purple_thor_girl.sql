CREATE TABLE `quote_catalogs` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`updated_at` text NOT NULL
);
