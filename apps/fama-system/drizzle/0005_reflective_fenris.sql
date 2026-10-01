ALTER TABLE `organizations` ADD `billing_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `block_on_expiry` integer DEFAULT true NOT NULL;