CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text DEFAULT '' NOT NULL,
	`user_email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_org_members_org_email` ON `organization_members` (`organization_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `idx_org_members_user_id` ON `organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_org_members_organization` ON `organization_members` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organizations_status` ON `organizations` (`status`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_appointments_org_start_at` ON `appointments` (`organization_id`,`start_at`);--> statement-breakpoint
ALTER TABLE `contracts` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_contracts_org_created_at` ON `contracts` (`organization_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `customers` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_customers_org_name` ON `customers` (`organization_id`,`name`);--> statement-breakpoint
ALTER TABLE `employees` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_employees_org_name` ON `employees` (`organization_id`,`name`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_inventory_org_name` ON `inventory_items` (`organization_id`,`name`);--> statement-breakpoint
ALTER TABLE `leads` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_leads_org_created_at` ON `leads` (`organization_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `quotes` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_quotes_org_created_at` ON `quotes` (`organization_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_transactions_org_due_date` ON `transactions` (`organization_id`,`due_date`);--> statement-breakpoint
ALTER TABLE `warranties` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_warranties_org_expires_at` ON `warranties` (`organization_id`,`expires_at`);--> statement-breakpoint
ALTER TABLE `work_orders` ADD `organization_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_work_orders_org_scheduled_at` ON `work_orders` (`organization_id`,`scheduled_at`);--> statement-breakpoint
PRAGMA optimize;
