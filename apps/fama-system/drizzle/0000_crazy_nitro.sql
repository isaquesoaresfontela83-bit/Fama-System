CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`client_name` text NOT NULL,
	`start_at` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`technician` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'Manutenção' NOT NULL,
	`status` text DEFAULT 'agendado' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_appointments_start_at` ON `appointments` (`start_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`pool_type` text DEFAULT '' NOT NULL,
	`pool_volume` integer,
	`plan` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_customers_name` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'unidade' NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`minimum_quantity` real DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_name` ON `inventory_items` (`name`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`interest` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'novo' NOT NULL,
	`estimated_value_cents` integer DEFAULT 0 NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leads_created_at` ON `leads` (`created_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_number` text NOT NULL,
	`client_name` text NOT NULL,
	`service` text NOT NULL,
	`materials_cents` integer DEFAULT 0 NOT NULL,
	`labor_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`valid_until` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quotes_number` ON `quotes` (`quote_number`);--> statement-breakpoint
CREATE INDEX `idx_quotes_created_at` ON `quotes` (`created_at`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_due_date` ON `transactions` (`due_date`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`os_number` text NOT NULL,
	`client_name` text NOT NULL,
	`service` text NOT NULL,
	`scheduled_at` text DEFAULT '' NOT NULL,
	`technician` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'aberta' NOT NULL,
	`ph` real,
	`chlorine` real,
	`alkalinity` real,
	`products_used` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_orders_number` ON `work_orders` (`os_number`);--> statement-breakpoint
CREATE INDEX `idx_work_orders_scheduled_at` ON `work_orders` (`scheduled_at`);--> statement-breakpoint
PRAGMA optimize;
