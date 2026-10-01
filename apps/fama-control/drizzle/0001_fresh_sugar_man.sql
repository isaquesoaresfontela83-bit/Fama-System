CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_number` text NOT NULL,
	`client_name` text NOT NULL,
	`client_document` text DEFAULT '' NOT NULL,
	`client_address` text DEFAULT '' NOT NULL,
	`service` text NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`frequency` text DEFAULT 'mensal' NOT NULL,
	`monthly_cents` integer DEFAULT 0 NOT NULL,
	`payment_day` integer,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contracts_number` ON `contracts` (`contract_number`);--> statement-breakpoint
CREATE INDEX `idx_contracts_created_at` ON `contracts` (`created_at`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'aqua' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_employees_name` ON `employees` (`name`);--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` text PRIMARY KEY NOT NULL,
	`warranty_number` text NOT NULL,
	`client_name` text NOT NULL,
	`item` text NOT NULL,
	`origin_reference` text DEFAULT '' NOT NULL,
	`purchase_date` text DEFAULT '' NOT NULL,
	`expires_at` text DEFAULT '' NOT NULL,
	`scheduled_at` text DEFAULT '' NOT NULL,
	`appointment_id` text DEFAULT '' NOT NULL,
	`technician` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ativa' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_warranties_number` ON `warranties` (`warranty_number`);--> statement-breakpoint
CREATE INDEX `idx_warranties_expires_at` ON `warranties` (`expires_at`);--> statement-breakpoint
PRAGMA optimize;
