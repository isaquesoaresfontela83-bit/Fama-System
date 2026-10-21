CREATE TABLE IF NOT EXISTS `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`institution` text DEFAULT '' NOT NULL,
	`account_type` text DEFAULT 'corrente' NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`provider_connection_id` text DEFAULT '' NOT NULL,
	`provider_account_id` text DEFAULT '' NOT NULL,
	`current_balance_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_accounts_org_name` ON `bank_accounts` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bank_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`item_hash` text NOT NULL,
	`encrypted_item_id` text NOT NULL,
	`institution` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ATIVA' NOT NULL,
	`last_synced_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_connections_org` ON `bank_connections` (`organization_id`,`provider`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bank_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`account_id` text NOT NULL,
	`posted_at` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`matched_transaction_id` text DEFAULT '' NOT NULL,
	`import_id` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`provider_transaction_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bank_movements_org_date` ON `bank_movements` (`organization_id`,`posted_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fiscal_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text DEFAULT 'nfse' NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`customer_name` text NOT NULL,
	`customer_document` text DEFAULT '' NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`service_description` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`issue_date` text DEFAULT '' NOT NULL,
	`official_number` text DEFAULT '' NOT NULL,
	`access_key` text DEFAULT '' NOT NULL,
	`xml_url` text DEFAULT '' NOT NULL,
	`pdf_url` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`provider_reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_fiscal_invoices_org_date` ON `fiscal_invoices` (`organization_id`,`issue_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`supplier_id` text DEFAULT '' NOT NULL,
	`supplier_name` text NOT NULL,
	`invoice_number` text DEFAULT '' NOT NULL,
	`purchase_date` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`payable_id` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_purchases_org_date` ON `purchases` (`organization_id`,`purchase_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_email` text NOT NULL,
	`buyer_document` text DEFAULT '' NOT NULL,
	`buyer_phone` text DEFAULT '' NOT NULL,
	`payment_id` text DEFAULT '' NOT NULL,
	`customer_id` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'manual_pix' NOT NULL,
	`proof_text` text DEFAULT '' NOT NULL,
	`proof_submitted_at` text DEFAULT '' NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscription_checkouts_payment` ON `subscription_checkouts` (`payment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscription_checkouts_email` ON `subscription_checkouts` (`buyer_email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_suppliers_org_name` ON `suppliers` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`organization_name` text DEFAULT '' NOT NULL,
	`user_id` text DEFAULT '' NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'melhoria' NOT NULL,
	`priority` text DEFAULT 'media' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'aberto' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_support_tickets_org_created` ON `support_tickets` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_support_tickets_status` ON `support_tickets` (`status`);--> statement-breakpoint
ALTER TABLE `organization_members` ADD `permissions` text DEFAULT '["dashboard","crm","quotes","agenda","orders","warranties","customers","contracts","inventory","finance","team"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `name_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan` text DEFAULT 'inicial' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan_status` text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan_expires_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `billing_customer_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `billing_payment_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `billing_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `pending_plan` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `pending_billing_cycle` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_organizations_billing_payment` ON `organizations` (`billing_payment_id`) WHERE "organizations"."billing_payment_id" <> '';