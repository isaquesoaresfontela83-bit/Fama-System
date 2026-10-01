-- Fama System + Fama Control: estrutura capturada em 2026-10-01T16:33:49.475574+00:00

-- PostgreSQL de origem: 17.6

-- Destino: projeto Supabase NOVO, com auth/storage/vault gerenciados pelo Supabase.

-- Não contém registros de empresas, usuários, documentos ou segredos.

-- Não execute este snapshot em produção existente; consulte documentacao/BANCO.md.

BEGIN;

SET LOCAL check_function_bodies = false;

SET LOCAL search_path = public, extensions, private, pg_catalog;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE SCHEMA IF NOT EXISTS private;

CREATE SCHEMA IF NOT EXISTS vault;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE TABLE "private"."frontend_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app" text NOT NULL,
  "source_url" text NOT NULL,
  "html" text NOT NULL,
  "sha256" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."appointments" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "title" text NOT NULL,
  "client_name" text NOT NULL,
  "start_at" text NOT NULL,
  "address" text DEFAULT ''::text NOT NULL,
  "technician" text DEFAULT ''::text NOT NULL,
  "kind" text DEFAULT 'Manutenção'::text NOT NULL,
  "status" text DEFAULT 'agendado'::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customer_id" text,
  "technician_id" text,
  "recurrence" text DEFAULT ''::text,
  "recurrence_interval_days" integer,
  "route_order" integer,
  "eta_minutes" integer,
  "delay_minutes" integer DEFAULT 0,
  "rescheduled_from" text,
  "completed_at" timestamp with time zone,
  "recurrence_parent_id" text
);

CREATE TABLE "public"."attachments" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "file_name" text NOT NULL,
  "object_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE "public"."audit_logs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME "public"."audit_logs_id_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE) NOT NULL,
  "organization_id" text,
  "actor_user_id" text,
  "event_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "record_id" text DEFAULT ''::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."bank_accounts" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "institution" text DEFAULT ''::text NOT NULL,
  "account_type" text DEFAULT 'corrente'::text NOT NULL,
  "opening_balance_cents" bigint DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "provider" text DEFAULT ''::text NOT NULL,
  "provider_connection_id" text DEFAULT ''::text NOT NULL,
  "provider_account_id" text DEFAULT ''::text NOT NULL,
  "current_balance_cents" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."bank_connections" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "provider" text NOT NULL,
  "item_hash" text NOT NULL,
  "encrypted_item_id" text NOT NULL,
  "institution" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'ATIVA'::text NOT NULL,
  "last_synced_at" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."bank_movements" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "account_id" text NOT NULL,
  "posted_at" text DEFAULT ''::text NOT NULL,
  "description" text NOT NULL,
  "amount_cents" bigint NOT NULL,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "matched_transaction_id" text DEFAULT ''::text NOT NULL,
  "import_id" text DEFAULT ''::text NOT NULL,
  "provider" text DEFAULT ''::text NOT NULL,
  "provider_transaction_id" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."chemical_dosage_rules" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "product_name" text NOT NULL,
  "problem_type" text DEFAULT ''::text NOT NULL,
  "dosage_per_10000_l" numeric,
  "dosage_unit" text DEFAULT ''::text NOT NULL,
  "instructions" text DEFAULT ''::text NOT NULL,
  "technical_warning" text DEFAULT 'Conferir rótulo do produto e validar tecnicamente antes da aplicação.'::text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."contracts" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "contract_number" text NOT NULL,
  "client_name" text NOT NULL,
  "client_document" text DEFAULT ''::text NOT NULL,
  "client_address" text DEFAULT ''::text NOT NULL,
  "service" text NOT NULL,
  "start_date" text DEFAULT ''::text NOT NULL,
  "end_date" text DEFAULT ''::text NOT NULL,
  "frequency" text DEFAULT 'mensal'::text NOT NULL,
  "monthly_cents" bigint DEFAULT 0 NOT NULL,
  "payment_day" integer,
  "status" text DEFAULT 'rascunho'::text NOT NULL,
  "terms" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "plan_id" text
);

CREATE TABLE "public"."customer_feedback" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text,
  "work_order_id" text,
  "rating" integer,
  "comment" text DEFAULT ''::text NOT NULL,
  "google_review_requested" boolean DEFAULT false NOT NULL,
  "referral_requested" boolean DEFAULT false NOT NULL,
  "contacted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."customer_subscriptions" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "plan_id" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "starts_on" date,
  "next_due_on" date,
  "monthly_cents" bigint DEFAULT 0 NOT NULL,
  "auto_billing" boolean DEFAULT false NOT NULL,
  "delinquent_since" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."customers" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "phone" text DEFAULT ''::text NOT NULL,
  "email" text DEFAULT ''::text NOT NULL,
  "address" text DEFAULT ''::text NOT NULL,
  "pool_type" text DEFAULT ''::text NOT NULL,
  "pool_volume" integer,
  "plan" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'ativo'::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "plan_id" text,
  "pool_shape" text,
  "pool_length_m" numeric(10,2),
  "pool_width_m" numeric(10,2),
  "pool_diameter_m" numeric(10,2),
  "pool_shallow_depth_m" numeric(10,2),
  "pool_deep_depth_m" numeric(10,2),
  "pool_volume_liters" integer,
  "filter_type" text,
  "pump_model" text,
  "maintenance_frequency" text,
  "problem_history" text DEFAULT ''::text,
  "condominium_mode" boolean DEFAULT false NOT NULL,
  "responsible_name" text DEFAULT ''::text,
  "responsible_phone" text DEFAULT ''::text,
  "responsible_email" text DEFAULT ''::text,
  "last_contact_at" timestamp with time zone
);

CREATE TABLE "public"."employee_commissions" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "employee_id" text,
  "employee_name" text DEFAULT ''::text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text DEFAULT ''::text NOT NULL,
  "base_cents" bigint DEFAULT 0 NOT NULL,
  "rate_pct" numeric DEFAULT 0 NOT NULL,
  "commission_cents" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "reference_month" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone
);

CREATE TABLE "public"."employees" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "role" text DEFAULT ''::text NOT NULL,
  "phone" text DEFAULT ''::text NOT NULL,
  "color" text DEFAULT 'aqua'::text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "commission_sale_pct" numeric DEFAULT 0 NOT NULL,
  "commission_service_pct" numeric DEFAULT 0 NOT NULL,
  "commission_referral_pct" numeric DEFAULT 0 NOT NULL
);

CREATE TABLE "public"."equipment_assets" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT ''::text NOT NULL,
  "serial_number" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "purchase_date" date,
  "next_maintenance_on" date,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."equipment_maintenance_logs" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "equipment_id" text NOT NULL,
  "maintenance_at" timestamp with time zone DEFAULT now() NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "cost_cents" bigint DEFAULT 0 NOT NULL,
  "technician" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."fama_control_admins" (
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."fama_control_backups" (
  "id" text NOT NULL,
  "label" text DEFAULT ''::text NOT NULL,
  "scope" text DEFAULT 'global'::text NOT NULL,
  "organization_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "checksum" text DEFAULT ''::text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "restored_at" timestamp with time zone,
  "restored_by_user_id" text
);

CREATE TABLE "public"."fama_quote_config" (
  "id" text DEFAULT 'pool-catalog'::text NOT NULL,
  "config" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."fama_settings" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."followups" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text,
  "lead_id" text,
  "quote_id" text,
  "type" text DEFAULT 'retorno'::text NOT NULL,
  "message" text DEFAULT ''::text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "appointment_id" text
);

CREATE TABLE "public"."inventory_items" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "sku" text DEFAULT ''::text NOT NULL,
  "unit" text DEFAULT 'unidade'::text NOT NULL,
  "quantity" double precision DEFAULT 0 NOT NULL,
  "minimum_quantity" double precision DEFAULT 0 NOT NULL,
  "cost_cents" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category" text DEFAULT ''::text,
  "active" boolean DEFAULT true NOT NULL
);

CREATE TABLE "public"."inventory_movements" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "inventory_item_id" text NOT NULL,
  "work_order_id" text,
  "movement_type" text NOT NULL,
  "quantity" double precision NOT NULL,
  "unit_cost_cents" bigint DEFAULT 0 NOT NULL,
  "note" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."leads" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "phone" text DEFAULT ''::text NOT NULL,
  "source" text DEFAULT ''::text NOT NULL,
  "interest" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'novo'::text NOT NULL,
  "estimated_value_cents" bigint DEFAULT 0 NOT NULL,
  "next_action" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_contact_at" timestamp with time zone,
  "follow_up_at" timestamp with time zone,
  "lost_reason" text DEFAULT ''::text,
  "referral_source" text DEFAULT ''::text
);

CREATE TABLE "public"."legal_consents" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "email_hash" text NOT NULL,
  "terms_version" text NOT NULL,
  "privacy_version" text NOT NULL,
  "source" text DEFAULT 'web'::text NOT NULL,
  "ip_hash" text DEFAULT ''::text NOT NULL,
  "user_agent_hash" text DEFAULT ''::text NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE TABLE "public"."maintenance_plans" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "frequency" text DEFAULT 'mensal'::text NOT NULL,
  "monthly_cents" bigint DEFAULT 0 NOT NULL,
  "visit_limit" integer,
  "includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."organization_members" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text DEFAULT ''::text NOT NULL,
  "user_email" text NOT NULL,
  "display_name" text DEFAULT ''::text NOT NULL,
  "role" text DEFAULT 'member'::text NOT NULL,
  "status" text DEFAULT 'invited'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "permissions" jsonb DEFAULT '["dashboard", "crm", "quotes", "agenda", "orders", "warranties", "customers", "contracts", "inventory", "finance", "team"]'::jsonb NOT NULL
);

CREATE TABLE "public"."organizations" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "name_key" text DEFAULT ''::text NOT NULL,
  "plan" text DEFAULT 'inicial'::text NOT NULL,
  "plan_status" text DEFAULT 'active'::text NOT NULL,
  "plan_expires_at" text DEFAULT ''::text NOT NULL,
  "billing_cycle" text DEFAULT 'monthly'::text NOT NULL,
  "pending_plan" text DEFAULT ''::text NOT NULL,
  "pending_billing_cycle" text DEFAULT 'monthly'::text NOT NULL,
  "billing_customer_id" text DEFAULT ''::text NOT NULL,
  "billing_payment_id" text DEFAULT ''::text NOT NULL,
  "billing_provider" text DEFAULT ''::text NOT NULL,
  "billing_enabled" boolean DEFAULT true NOT NULL,
  "block_on_expiry" boolean DEFAULT true NOT NULL
);

CREATE TABLE "public"."platform_settings" (
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text DEFAULT ''::text NOT NULL
);

CREATE TABLE "public"."pool_issue_history" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "issue_type" text NOT NULL,
  "details" text DEFAULT ''::text NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "recurrence_days" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."pool_quote_calculations" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "title" text DEFAULT 'Orçamento de piscina'::text NOT NULL,
  "customer_name" text,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subtotal_services" numeric DEFAULT 0 NOT NULL,
  "subtotal_materials" numeric DEFAULT 0 NOT NULL,
  "subtotal_labor" numeric DEFAULT 0 NOT NULL,
  "subtotal_other" numeric DEFAULT 0 NOT NULL,
  "subtotal_cost" numeric DEFAULT 0 NOT NULL,
  "markup_percent" numeric DEFAULT 0 NOT NULL,
  "discount_value" numeric DEFAULT 0 NOT NULL,
  "final_total" numeric DEFAULT 0 NOT NULL,
  "customer_id" text,
  "template_id" text,
  "pool_volume_liters" integer DEFAULT 0 NOT NULL,
  "distance_km" numeric DEFAULT 0 NOT NULL,
  "urgency_percent" numeric DEFAULT 0 NOT NULL,
  "discount_percent" numeric DEFAULT 0 NOT NULL,
  "urgency_value" numeric DEFAULT 0 NOT NULL,
  "travel_value" numeric DEFAULT 0 NOT NULL,
  "total_cost" numeric DEFAULT 0 NOT NULL,
  "gross_profit" numeric DEFAULT 0 NOT NULL,
  "valid_until" date,
  "quote_id" text
);

CREATE TABLE "public"."pool_quote_catalog_items" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "unit" text DEFAULT 'un'::text NOT NULL,
  "default_quantity" numeric DEFAULT 1 NOT NULL,
  "unit_cost" numeric DEFAULT 0 NOT NULL,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "unit_price" numeric DEFAULT 0 NOT NULL,
  "pricing_mode" text DEFAULT 'unit'::text NOT NULL,
  "minimum_charge" numeric DEFAULT 0 NOT NULL,
  "service_key" text DEFAULT ''::text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "inventory_item_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."pool_quote_templates" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "service_key" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "default_markup_percent" numeric DEFAULT 0 NOT NULL,
  "urgency_percent" numeric DEFAULT 0 NOT NULL,
  "travel_rate_per_km" numeric DEFAULT 0 NOT NULL,
  "travel_cost_per_km" numeric DEFAULT 0 NOT NULL,
  "default_valid_days" integer DEFAULT 7 NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."privacy_requests" (
  "id" text NOT NULL,
  "organization_id" text,
  "requester_user_id" text NOT NULL,
  "requester_email_hash" text NOT NULL,
  "request_type" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "details" text DEFAULT ''::text NOT NULL,
  "resolution" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "contact_encrypted" text DEFAULT ''::text NOT NULL
);

CREATE TABLE "public"."protected_records" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "record_id" text NOT NULL,
  "reason" text DEFAULT ''::text NOT NULL,
  "protected_by_user_id" text NOT NULL,
  "protected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."purchases" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "supplier_id" text DEFAULT ''::text NOT NULL,
  "supplier_name" text NOT NULL,
  "invoice_number" text DEFAULT ''::text NOT NULL,
  "purchase_date" text DEFAULT ''::text NOT NULL,
  "due_date" text DEFAULT ''::text NOT NULL,
  "amount_cents" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "payable_id" text DEFAULT ''::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."quotes" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "quote_number" text NOT NULL,
  "client_name" text NOT NULL,
  "service" text NOT NULL,
  "materials_cents" bigint DEFAULT 0 NOT NULL,
  "labor_cents" bigint DEFAULT 0 NOT NULL,
  "discount_cents" bigint DEFAULT 0 NOT NULL,
  "total_cents" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'rascunho'::text NOT NULL,
  "valid_until" text DEFAULT ''::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customer_id" text,
  "products_cents" bigint DEFAULT 0 NOT NULL,
  "travel_cents" bigint DEFAULT 0 NOT NULL,
  "urgency_cents" bigint DEFAULT 0 NOT NULL,
  "converted_work_order_id" text,
  "employee_id" text,
  "products_description" text DEFAULT ''::text NOT NULL
);

CREATE TABLE "public"."recovery_snapshots" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "record_id" text NOT NULL,
  "encrypted_payload" text NOT NULL,
  "deleted_by_user_id" text NOT NULL,
  "deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "restored_at" timestamp with time zone,
  "restored_by_user_id" text
);

CREATE TABLE "public"."referrals" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "referrer_customer_id" text,
  "referrer_name" text DEFAULT ''::text NOT NULL,
  "referred_customer_id" text,
  "referred_name" text DEFAULT ''::text NOT NULL,
  "reward_type" text DEFAULT 'desconto'::text NOT NULL,
  "reward_cents" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "employee_id" text
);

CREATE TABLE "public"."request_rate_limits" (
  "key_hash" text NOT NULL,
  "action" text NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."service_price_catalog" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'servico'::text NOT NULL,
  "price_cents" bigint DEFAULT 0 NOT NULL,
  "cost_cents" bigint DEFAULT 0 NOT NULL,
  "unit" text DEFAULT 'servico'::text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."service_reports" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text,
  "work_order_id" text,
  "report_number" text DEFAULT ''::text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "pdf_url" text DEFAULT ''::text NOT NULL,
  "signed_by" text DEFAULT ''::text NOT NULL,
  "signed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."suppliers" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "name" text NOT NULL,
  "document" text DEFAULT ''::text NOT NULL,
  "email" text DEFAULT ''::text NOT NULL,
  "phone" text DEFAULT ''::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."support_tickets" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "organization_name" text DEFAULT ''::text NOT NULL,
  "user_id" text DEFAULT ''::text NOT NULL,
  "user_email" text DEFAULT ''::text NOT NULL,
  "type" text DEFAULT 'melhoria'::text NOT NULL,
  "priority" text DEFAULT 'media'::text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'aberto'::text NOT NULL,
  "admin_notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."transactions" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "description" text NOT NULL,
  "type" text NOT NULL,
  "category" text DEFAULT ''::text NOT NULL,
  "amount_cents" bigint DEFAULT 0 NOT NULL,
  "due_date" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customer_id" text,
  "payment_method" text DEFAULT ''::text,
  "paid_at" timestamp with time zone,
  "collection_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subscription_id" text
);

CREATE TABLE "public"."warranties" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "warranty_number" text NOT NULL,
  "client_name" text NOT NULL,
  "item" text NOT NULL,
  "origin_reference" text DEFAULT ''::text NOT NULL,
  "purchase_date" text DEFAULT ''::text NOT NULL,
  "expires_at" text DEFAULT ''::text NOT NULL,
  "scheduled_at" text DEFAULT ''::text NOT NULL,
  "appointment_id" text DEFAULT ''::text NOT NULL,
  "technician" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'ativa'::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."water_tests" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text,
  "work_order_id" text,
  "tested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ph" double precision,
  "free_chlorine" double precision,
  "alkalinity" double precision,
  "calcium_hardness" double precision,
  "stabilizer" double precision,
  "appearance" text DEFAULT ''::text NOT NULL,
  "observations" text DEFAULT ''::text NOT NULL,
  "before_photo_url" text DEFAULT ''::text NOT NULL,
  "after_photo_url" text DEFAULT ''::text NOT NULL,
  "technician" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."work_order_items" (
  "id" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "organization_id" text NOT NULL,
  "work_order_id" text NOT NULL,
  "inventory_item_id" text,
  "description" text NOT NULL,
  "quantity" double precision DEFAULT 0 NOT NULL,
  "unit_cost_cents" bigint DEFAULT 0 NOT NULL,
  "unit_price_cents" bigint DEFAULT 0 NOT NULL,
  "applied" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."work_orders" (
  "id" text NOT NULL,
  "organization_id" text NOT NULL,
  "os_number" text NOT NULL,
  "client_name" text NOT NULL,
  "service" text NOT NULL,
  "scheduled_at" text DEFAULT ''::text NOT NULL,
  "technician" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'aberta'::text NOT NULL,
  "ph" double precision,
  "chlorine" double precision,
  "alkalinity" double precision,
  "products_used" text DEFAULT ''::text NOT NULL,
  "notes" text DEFAULT ''::text NOT NULL,
  "amount_cents" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customer_id" text,
  "appointment_id" text,
  "quote_id" text,
  "calcium_hardness" double precision,
  "stabilizer" double precision,
  "water_appearance" text DEFAULT ''::text,
  "checklist" jsonb DEFAULT '{"medir_ph": false, "medir_cloro": false, "aspirar_fundo": false, "escovar_bordas": false, "aplicar_produto": false, "tirar_foto_final": false, "cliente_confirmou": false, "limpar_pre_filtro": false}'::jsonb NOT NULL,
  "before_photo_url" text DEFAULT ''::text,
  "after_photo_url" text DEFAULT ''::text,
  "customer_confirmation" text DEFAULT ''::text,
  "product_cost_cents" bigint DEFAULT 0 NOT NULL,
  "labor_cost_cents" bigint DEFAULT 0 NOT NULL,
  "travel_cost_cents" bigint DEFAULT 0 NOT NULL,
  "gross_profit_cents" bigint DEFAULT 0 NOT NULL,
  "completed_at" timestamp with time zone
);

ALTER TABLE "private"."frontend_snapshots" ADD CONSTRAINT "frontend_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."bank_accounts" ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."bank_connections" ADD CONSTRAINT "bank_connections_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."bank_movements" ADD CONSTRAINT "bank_movements_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."chemical_dosage_rules" ADD CONSTRAINT "chemical_dosage_rules_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."customer_feedback" ADD CONSTRAINT "customer_feedback_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."employee_commissions" ADD CONSTRAINT "employee_commissions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."equipment_assets" ADD CONSTRAINT "equipment_assets_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."equipment_maintenance_logs" ADD CONSTRAINT "equipment_maintenance_logs_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."fama_control_admins" ADD CONSTRAINT "fama_control_admins_pkey" PRIMARY KEY (user_id);

ALTER TABLE "public"."fama_control_backups" ADD CONSTRAINT "fama_control_backups_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."fama_quote_config" ADD CONSTRAINT "fama_quote_config_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."fama_settings" ADD CONSTRAINT "fama_settings_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."followups" ADD CONSTRAINT "followups_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."legal_consents" ADD CONSTRAINT "legal_consents_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."maintenance_plans" ADD CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."platform_settings" ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY (key);

ALTER TABLE "public"."pool_issue_history" ADD CONSTRAINT "pool_issue_history_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."pool_quote_calculations" ADD CONSTRAINT "pool_quote_calculations_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."pool_quote_catalog_items" ADD CONSTRAINT "pool_quote_catalog_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."pool_quote_templates" ADD CONSTRAINT "pool_quote_templates_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."privacy_requests" ADD CONSTRAINT "privacy_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."protected_records" ADD CONSTRAINT "protected_records_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."purchases" ADD CONSTRAINT "purchases_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."recovery_snapshots" ADD CONSTRAINT "recovery_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."request_rate_limits" ADD CONSTRAINT "request_rate_limits_pkey" PRIMARY KEY (key_hash, action);

ALTER TABLE "public"."service_price_catalog" ADD CONSTRAINT "service_price_catalog_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."service_reports" ADD CONSTRAINT "service_reports_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."warranties" ADD CONSTRAINT "warranties_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."water_tests" ADD CONSTRAINT "water_tests_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."work_order_items" ADD CONSTRAINT "work_order_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_object_path_key" UNIQUE (object_path);

ALTER TABLE "public"."bank_connections" ADD CONSTRAINT "bank_connections_organization_id_provider_item_hash_key" UNIQUE (organization_id, provider, item_hash);

ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_organization_id_contract_number_key" UNIQUE (organization_id, contract_number);

ALTER TABLE "public"."fama_control_admins" ADD CONSTRAINT "fama_control_admins_email_key" UNIQUE (email);

ALTER TABLE "public"."fama_settings" ADD CONSTRAINT "fama_settings_organization_id_key_key" UNIQUE (organization_id, key);

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_organization_id_user_email_key" UNIQUE (organization_id, user_email);

ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_slug_key" UNIQUE (slug);

ALTER TABLE "public"."pool_quote_templates" ADD CONSTRAINT "pool_quote_templates_organization_id_service_key_key" UNIQUE (organization_id, service_key);

ALTER TABLE "public"."protected_records" ADD CONSTRAINT "protected_records_organization_id_entity_type_record_id_key" UNIQUE (organization_id, entity_type, record_id);

ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_organization_id_quote_number_key" UNIQUE (organization_id, quote_number);

ALTER TABLE "public"."warranties" ADD CONSTRAINT "warranties_organization_id_warranty_number_key" UNIQUE (organization_id, warranty_number);

ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_organization_id_os_number_key" UNIQUE (organization_id, os_number);

ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_status_check" CHECK (status = ANY (ARRAY['agendado'::text, 'confirmado'::text, 'em_rota'::text, 'concluido'::text, 'cancelado'::text]));

ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_entity_type_check" CHECK (entity_type = ANY (ARRAY['leads'::text, 'quotes'::text, 'appointments'::text, 'workOrders'::text, 'customers'::text, 'inventory'::text, 'transactions'::text, 'employees'::text, 'warranties'::text, 'contracts'::text, 'suppliers'::text, 'purchases'::text, 'fiscalInvoices'::text]));

ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_size_bytes_check" CHECK (size_bytes >= 0);

ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_event_type_check" CHECK (event_type = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text, 'security'::text, 'login'::text, 'logout'::text, 'export'::text, 'restore'::text]));

ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_payment_day_check" CHECK (payment_day >= 1 AND payment_day <= 31);

ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_status_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'ativo'::text, 'suspenso'::text, 'encerrado'::text]));

ALTER TABLE "public"."fama_control_backups" ADD CONSTRAINT "fama_control_backups_scope_check" CHECK (scope = ANY (ARRAY['global'::text, 'organization'::text]));

ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_status_check" CHECK (status = ANY (ARRAY['novo'::text, 'contato'::text, 'visita'::text, 'proposta'::text, 'ganho'::text, 'perdido'::text]));

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_permissions_is_array" CHECK (jsonb_typeof(permissions) = 'array'::text);

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'technician'::text]));

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_status_check" CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'inactive'::text]));

ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_status_check" CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text]));

ALTER TABLE "public"."pool_quote_catalog_items" ADD CONSTRAINT "pool_quote_catalog_items_kind_check" CHECK (kind = ANY (ARRAY['service'::text, 'material'::text, 'labor'::text, 'other'::text]));

ALTER TABLE "public"."pool_quote_catalog_items" ADD CONSTRAINT "pool_quote_catalog_items_unit_cost_check" CHECK (unit_cost >= 0::numeric);

ALTER TABLE "public"."privacy_requests" ADD CONSTRAINT "privacy_requests_request_type_check" CHECK (request_type = ANY (ARRAY['access'::text, 'correction'::text, 'export'::text, 'deletion'::text, 'revocation'::text]));

ALTER TABLE "public"."privacy_requests" ADD CONSTRAINT "privacy_requests_status_check" CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text]));

ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_status_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'aprovado'::text, 'recusado'::text]));

ALTER TABLE "public"."request_rate_limits" ADD CONSTRAINT "request_rate_limits_request_count_check" CHECK (request_count > 0);

ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_priority_check" CHECK (priority = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text]));

ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_status_check" CHECK (status = ANY (ARRAY['aberto'::text, 'em_analise'::text, 'resolvido'::text]));

ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_type_check" CHECK (type = ANY (ARRAY['melhoria'::text, 'erro'::text, 'duvida'::text, 'financeiro'::text]));

ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'pago'::text, 'recebido'::text, 'atrasado'::text, 'cancelado'::text]));

ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_type_check" CHECK (type = ANY (ARRAY['receita'::text, 'despesa'::text]));

ALTER TABLE "public"."warranties" ADD CONSTRAINT "warranties_status_check" CHECK (status = ANY (ARRAY['ativa'::text, 'acionada'::text, 'agendada'::text, 'concluida'::text, 'expirada'::text]));

ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_status_check" CHECK (status = ANY (ARRAY['aberta'::text, 'agendada'::text, 'em_execucao'::text, 'concluida'::text, 'cancelada'::text]));

ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."bank_connections" ADD CONSTRAINT "bank_connections_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."bank_movements" ADD CONSTRAINT "bank_movements_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."chemical_dosage_rules" ADD CONSTRAINT "chemical_dosage_rules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."customer_feedback" ADD CONSTRAINT "customer_feedback_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."employee_commissions" ADD CONSTRAINT "employee_commissions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."equipment_assets" ADD CONSTRAINT "equipment_assets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."equipment_maintenance_logs" ADD CONSTRAINT "equipment_maintenance_logs_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES equipment_assets(id) ON DELETE CASCADE;

ALTER TABLE "public"."equipment_maintenance_logs" ADD CONSTRAINT "equipment_maintenance_logs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."fama_control_backups" ADD CONSTRAINT "fama_control_backups_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE "public"."fama_settings" ADD CONSTRAINT "fama_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."followups" ADD CONSTRAINT "followups_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."maintenance_plans" ADD CONSTRAINT "maintenance_plans_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."pool_issue_history" ADD CONSTRAINT "pool_issue_history_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."pool_quote_calculations" ADD CONSTRAINT "pool_quote_calculations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."pool_quote_catalog_items" ADD CONSTRAINT "pool_quote_catalog_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."privacy_requests" ADD CONSTRAINT "privacy_requests_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE "public"."protected_records" ADD CONSTRAINT "protected_records_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."purchases" ADD CONSTRAINT "purchases_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."service_price_catalog" ADD CONSTRAINT "service_price_catalog_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."service_reports" ADD CONSTRAINT "service_reports_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."warranties" ADD CONSTRAINT "warranties_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."water_tests" ADD CONSTRAINT "water_tests_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."work_order_items" ADD CONSTRAINT "work_order_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE "public"."work_orders" ADD CONSTRAINT "work_orders_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.can_manage_team(p_organization_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.status = 'active'
      and o.status = 'active'
      and o.deleted_at is null
      and (
        m.user_id = auth.uid()::text
        or lower(m.user_email) = lower(coalesce(auth.jwt()->>'email',''))
      )
      and (m.role = 'owner' or m.permissions ? 'team')
  );
$function$;

CREATE OR REPLACE FUNCTION private.current_user_email()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select lower(coalesce(auth.jwt()->>'email',''));
$function$;

CREATE OR REPLACE FUNCTION private.fama_apply_work_order_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare i record; product_cost bigint:=0; begin
  if new.status='executado' and old.status is distinct from 'executado' then
    for i in select * from public.work_order_items where organization_id=new.organization_id and work_order_id=new.id and applied=false for update loop
      product_cost:=product_cost+round(i.quantity*i.unit_cost_cents)::bigint;
      if i.inventory_item_id is not null and i.inventory_item_id<>'' then
        update public.inventory_items set quantity=quantity-i.quantity,updated_at=now() where id=i.inventory_item_id and organization_id=new.organization_id;
        insert into public.inventory_movements(id,organization_id,inventory_item_id,work_order_id,movement_type,quantity,unit_cost_cents,note)
        values(gen_random_uuid()::text,new.organization_id,i.inventory_item_id,new.id,'saida',-i.quantity,i.unit_cost_cents,'Baixa automática ao executar OS');
      end if;
      update public.work_order_items set applied=true,updated_at=now() where id=i.id;
    end loop;
    update public.work_orders set completed_at=coalesce(new.completed_at,now()),product_cost_cents=product_cost,gross_profit_cents=new.amount_cents-product_cost-coalesce(new.labor_cost_cents,0)-coalesce(new.travel_cost_cents,0) where id=new.id;
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.fama_audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  org text;
  rid text;
  actor text;
  before_row jsonb;
  after_row jsonb;
begin
  actor := (select auth.uid())::text;
  if tg_op='INSERT' then
    org := new.organization_id;
    rid := new.id;
    before_row := null;
    after_row := to_jsonb(new);
  elsif tg_op='UPDATE' then
    org := coalesce(new.organization_id,old.organization_id);
    rid := coalesce(new.id,old.id);
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
  else
    org := old.organization_id;
    rid := old.id;
    before_row := to_jsonb(old);
    after_row := null;
  end if;
  insert into public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
  values(org,actor,lower(tg_op),tg_table_name,coalesce(rid,''),jsonb_build_object('before',before_row,'after',after_row,'source','row_audit'));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_control_daily_backup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public', 'extensions'
AS $function$
declare
  p jsonb;
  sum_text text;
begin
  p := jsonb_build_object(
    'format','fama-control-backup','version','16.0','created_at',now(),'scope','global','organization_id',null,
    'data',jsonb_build_object(
      'organizations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.organizations t),
      'organization_members',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.organization_members t),
      'customers',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.customers t),
      'leads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.leads t),
      'quotes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.quotes t),
      'appointments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.appointments t),
      'work_orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.work_orders t),
      'inventory_items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.inventory_items t),
      'transactions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.transactions t),
      'employees',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.employees t),
      'contracts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.contracts t),
      'service_price_catalog',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.service_price_catalog t),
      'maintenance_plans',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.maintenance_plans t),
      'customer_subscriptions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.customer_subscriptions t),
      'water_tests',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.water_tests t),
      'followups',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.followups t),
      'referrals',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.referrals t),
      'equipment_assets',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.equipment_assets t),
      'equipment_maintenance_logs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.equipment_maintenance_logs t),
      'work_order_items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.work_order_items t),
      'inventory_movements',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.inventory_movements t),
      'employee_commissions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.employee_commissions t),
      'customer_feedback',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.customer_feedback t),
      'service_reports',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.service_reports t),
      'pool_issue_history',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.pool_issue_history t),
      'chemical_dosage_rules',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.chemical_dosage_rules t),
      'fama_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.fama_settings t)
    )
  );
  sum_text := encode(digest(convert_to(p::text,'UTF8'),'sha256'),'hex');
  insert into public.fama_control_backups(id,label,scope,organization_id,payload,checksum,created_by_user_id)
  values(gen_random_uuid()::text,'Backup diário automático','global',null,p,sum_text,'system:daily-backup');
  delete from public.fama_control_backups where created_by_user_id='system:daily-backup' and created_at < now() - interval '30 days';
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_enrich_backup_payload()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public', 'extensions'
AS $function$
declare
  d jsonb;
  org text:=new.organization_id;
  scope_name text:=new.scope;
  q text;
  arr jsonb;
  t text;
  extra_tables text[]:=array[
    'service_price_catalog','maintenance_plans','customer_subscriptions','water_tests','followups','referrals',
    'equipment_assets','equipment_maintenance_logs','work_order_items','inventory_movements','employee_commissions',
    'customer_feedback','service_reports','pool_issue_history','chemical_dosage_rules','fama_settings'
  ];
begin
  d:=coalesce(new.payload->'data','{}'::jsonb);
  foreach t in array extra_tables loop
    if scope_name='organization' and org is not null then
      q:=format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where organization_id=$1',t);
      execute q into arr using org;
    else
      q:=format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t);
      execute q into arr;
    end if;
    d:=jsonb_set(d,array[t],coalesce(arr,'[]'::jsonb),true);
  end loop;
  new.payload:=jsonb_set(new.payload,'{data}',d,true);
  new.checksum:=encode(digest(convert_to(new.payload::text,'UTF8'),'sha256'),'hex');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_generate_followups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
  insert into public.followups(id,organization_id,quote_id,type,message,due_at,status)
  select gen_random_uuid()::text,q.organization_id,q.id,'quote_expiry','Orçamento vence amanhã.',now(),'pending'
  from public.quotes q
  where q.status not in ('aprovado','recusado','cancelado') and q.valid_until ~ '^\d{4}-\d{2}-\d{2}'
    and substring(q.valid_until from 1 for 10)::date=current_date+1
    and not exists(select 1 from public.followups f where f.organization_id=q.organization_id and f.quote_id=q.id and f.type='quote_expiry' and f.status='pending');

  insert into public.followups(id,organization_id,customer_id,appointment_id,type,message,due_at,status)
  select gen_random_uuid()::text,a.organization_id,a.customer_id,a.id,'maintenance_overdue','Manutenção atrasada: '||a.client_name||'.',now(),'pending'
  from public.appointments a
  where a.status in ('agendado','em rota','remarcado') and a.start_at ~ '^\d{4}-\d{2}-\d{2}'
    and substring(a.start_at from 1 for 10)::date<current_date
    and not exists(select 1 from public.followups f where f.organization_id=a.organization_id and f.appointment_id=a.id and f.type='maintenance_overdue' and f.status='pending');

  insert into public.followups(id,organization_id,lead_id,type,message,due_at,status)
  select gen_random_uuid()::text,l.organization_id,l.id,'lead_return',case when coalesce(l.next_action,'')<>'' then l.next_action else 'Cliente pediu para ligar depois.' end,coalesce(l.follow_up_at,now()),'pending'
  from public.leads l
  where l.status not in ('fechado','perdido') and l.follow_up_at is not null and l.follow_up_at<=now()
    and not exists(select 1 from public.followups f where f.organization_id=l.organization_id and f.lead_id=l.id and f.type='lead_return' and f.status='pending');

  insert into public.followups(id,organization_id,customer_id,type,message,due_at,status)
  select gen_random_uuid()::text,c.organization_id,c.id,'customer_30d','Cliente sem contato há 30 dias.',now(),'pending'
  from public.customers c
  where c.status='ativo' and coalesce(c.last_contact_at,c.updated_at,c.created_at)<now()-interval '30 days'
    and not exists(select 1 from public.followups f where f.organization_id=c.organization_id and f.customer_id=c.id and f.type='customer_30d' and f.status='pending');

  insert into public.followups(id,organization_id,type,message,due_at,status)
  select gen_random_uuid()::text,i.organization_id,'stock_low','Estoque mínimo: '||i.name||' ('||i.quantity||' '||i.unit||').',now(),'pending'
  from public.inventory_items i
  where i.active=true and i.quantity<=i.minimum_quantity
    and not exists(select 1 from public.followups f where f.organization_id=i.organization_id and f.type='stock_low' and f.message like 'Estoque mínimo: '||i.name||'%' and f.status='pending');

  insert into public.followups(id,organization_id,type,message,due_at,status)
  select gen_random_uuid()::text,e.organization_id,'equipment_maintenance','Manutenção de equipamento vencendo/vencida: '||e.name||'.',now(),'pending'
  from public.equipment_assets e
  where e.status='active' and e.next_maintenance_on is not null and e.next_maintenance_on<=current_date+7
    and not exists(select 1 from public.followups f where f.organization_id=e.organization_id and f.type='equipment_maintenance' and f.message like '%: '||e.name||'.' and f.status='pending');
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_pool_volume_liters(p_shape text, p_length numeric DEFAULT NULL::numeric, p_width numeric DEFAULT NULL::numeric, p_diameter numeric DEFAULT NULL::numeric, p_shallow_depth numeric DEFAULT NULL::numeric, p_deep_depth numeric DEFAULT NULL::numeric, p_custom_area numeric DEFAULT NULL::numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'private', 'public'
AS $function$
declare
  avg_depth numeric := greatest(coalesce((coalesce(p_shallow_depth,0)+coalesce(p_deep_depth,0))/2,0),0);
  cubic_m numeric := 0;
begin
  case lower(coalesce(p_shape,''))
    when 'retangular' then cubic_m := greatest(coalesce(p_length,0),0) * greatest(coalesce(p_width,0),0) * avg_depth;
    when 'redonda' then cubic_m := pi() * power(greatest(coalesce(p_diameter,0),0)/2,2) * avg_depth;
    when 'oval' then cubic_m := pi() * (greatest(coalesce(p_length,0),0)/2) * (greatest(coalesce(p_width,0),0)/2) * avg_depth;
    when 'irregular' then cubic_m := greatest(coalesce(p_custom_area,0),0) * avg_depth;
    else cubic_m := 0;
  end case;
  return greatest(round(cubic_m * 1000),0)::integer;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_post_sale_followup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
  if new.status='executado' and old.status is distinct from 'executado' then
    if not exists(select 1 from public.followups f where f.organization_id=new.organization_id and f.type='post_sale' and f.message like '%'||new.id||'%' and f.status='pending') then
      insert into public.followups(id,organization_id,customer_id,type,message,due_at,status)
      values(gen_random_uuid()::text,new.organization_id,new.customer_id,'post_sale','Pós-venda da OS '||new.id||': enviar mensagem, registrar satisfação e pedir avaliação/indicação.',now()+interval '1 day','pending');
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_recurring_billing()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare s record; tx_id text; begin
  update public.transactions set status='atrasado',updated_at=now()
  where status in ('aberto','pendente') and due_date ~ '^\d{4}-\d{2}-\d{2}' and substring(due_date from 1 for 10)::date<current_date;

  for s in select * from public.customer_subscriptions where status='active' and next_due_on is not null and next_due_on<=current_date loop
    if not exists(select 1 from public.transactions t where t.organization_id=s.organization_id and t.subscription_id=s.id and t.due_date=s.next_due_on::text) then
      tx_id:=gen_random_uuid()::text;
      insert into public.transactions(id,organization_id,description,type,category,amount_cents,due_date,status,customer_id,subscription_id)
      values(tx_id,s.organization_id,'Mensalidade de plano','receita','mensalidade',s.monthly_cents,s.next_due_on::text,'aberto',s.customer_id,s.id);
    end if;
    update public.customer_subscriptions set next_due_on=(s.next_due_on+interval '1 month')::date,updated_at=now() where id=s.id;
  end loop;

  update public.customer_subscriptions s set delinquent_since=coalesce(s.delinquent_since,current_date),updated_at=now()
  where exists(select 1 from public.transactions t where t.organization_id=s.organization_id and t.subscription_id=s.id and t.status='atrasado');

  update public.customer_subscriptions s set delinquent_since=null,updated_at=now()
  where s.delinquent_since is not null and not exists(select 1 from public.transactions t where t.organization_id=s.organization_id and t.subscription_id=s.id and t.status='atrasado');
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_referral_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare e public.employees%rowtype; commission bigint; begin
  if lower(new.status) in ('concluida','concluída','fechado','completed') and lower(coalesce(old.status,'')) not in ('concluida','concluída','fechado','completed') and new.employee_id is not null then
    select * into e from public.employees where id=new.employee_id and organization_id=new.organization_id and active=true limit 1;
    if found and coalesce(e.commission_referral_pct,0)>0 and not exists(select 1 from public.employee_commissions c where c.organization_id=new.organization_id and c.source_type='referral' and c.source_id=new.id) then
      commission:=round(new.reward_cents*(e.commission_referral_pct/100.0))::bigint;
      insert into public.employee_commissions(id,organization_id,employee_id,employee_name,source_type,source_id,base_cents,rate_pct,commission_cents,status,reference_month)
      values(gen_random_uuid()::text,new.organization_id,e.id,e.name,'referral',new.id,new.reward_cents,e.commission_referral_pct,commission,'open',to_char(now(),'YYYY-MM'));
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_sales_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare e public.employees%rowtype; commission bigint; begin
  if new.status='aprovado' and old.status is distinct from 'aprovado' and new.employee_id is not null then
    select * into e from public.employees where id=new.employee_id and organization_id=new.organization_id and active=true limit 1;
    if found and coalesce(e.commission_sale_pct,0)>0 and not exists(select 1 from public.employee_commissions c where c.organization_id=new.organization_id and c.source_type='sale' and c.source_id=new.id) then
      commission:=round(new.total_cents*(e.commission_sale_pct/100.0))::bigint;
      insert into public.employee_commissions(id,organization_id,employee_id,employee_name,source_type,source_id,base_cents,rate_pct,commission_cents,status,reference_month)
      values(gen_random_uuid()::text,new.organization_id,e.id,e.name,'sale',new.id,new.total_cents,e.commission_sale_pct,commission,'open',to_char(now(),'YYYY-MM'));
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_schedule_next_maintenance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  interval_days integer := 0;
  base_time timestamptz;
  next_time timestamptz;
  next_id text;
begin
  if new.status <> 'executado' or old.status is not distinct from 'executado' then return new; end if;
  interval_days := case lower(coalesce(new.recurrence,''))
    when 'semanal' then 7
    when 'quinzenal' then 15
    when 'mensal' then 30
    else coalesce(new.recurrence_interval_days,0)
  end;
  if interval_days <= 0 then return new; end if;
  begin
    base_time := new.start_at::timestamptz;
  exception when others then
    return new;
  end;
  next_time := base_time + make_interval(days => interval_days);
  if exists (
    select 1 from public.appointments a
    where a.organization_id=new.organization_id
      and a.recurrence_parent_id=new.id
      and a.status <> 'cancelado'
  ) then return new; end if;
  next_id := gen_random_uuid()::text;
  insert into public.appointments(
    id,organization_id,title,client_name,start_at,address,technician,kind,status,notes,
    customer_id,technician_id,recurrence,recurrence_interval_days,route_order,eta_minutes,delay_minutes,recurrence_parent_id
  ) values(
    next_id,new.organization_id,new.title,new.client_name,next_time::text,new.address,new.technician,new.kind,'agendado',
    case when coalesce(new.notes,'')='' then 'Gerado automaticamente por recorrência.' else new.notes || E'\nGerado automaticamente por recorrência.' end,
    new.customer_id,new.technician_id,new.recurrence,new.recurrence_interval_days,null,null,0,new.id
  );
  insert into public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
  values(new.organization_id,(select auth.uid())::text,'create','appointments',next_id,
    jsonb_build_object('source','recurrence','previous_appointment_id',new.id,'interval_days',interval_days));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_service_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare e public.employees%rowtype; commission bigint; begin
  if new.status='executado' and old.status is distinct from 'executado' and coalesce(new.technician,'')<>'' then
    select * into e from public.employees
    where organization_id=new.organization_id and active=true and lower(name)=lower(new.technician) limit 1;
    if found and coalesce(e.commission_service_pct,0)>0 and not exists(
      select 1 from public.employee_commissions c where c.organization_id=new.organization_id and c.source_type='service' and c.source_id=new.id
    ) then
      commission:=round(new.amount_cents*(e.commission_service_pct/100.0))::bigint;
      insert into public.employee_commissions(id,organization_id,employee_id,employee_name,source_type,source_id,base_cents,rate_pct,commission_cents,status,reference_month)
      values(gen_random_uuid()::text,new.organization_id,e.id,e.name,'service',new.id,new.amount_cents,e.commission_service_pct,commission,'open',to_char(now(),'YYYY-MM'));
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.fama_update_visit_delays()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
begin
  update public.appointments
  set delay_minutes=greatest(0,floor(extract(epoch from (now()-start_at::timestamptz))/60)::integer),updated_at=now()
  where status in ('agendado','em rota','remarcado')
    and start_at ~ '^\d{4}-\d{2}-\d{2}'
    and start_at::timestamptz < now();
  update public.appointments set delay_minutes=0,updated_at=now()
  where status in ('executado','cancelado') and delay_minutes<>0;
end;
$function$;

CREATE OR REPLACE FUNCTION private.has_org_permission(p_organization_id text, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where auth.uid() is not null
      and m.organization_id = p_organization_id
      and m.status = 'active' and o.status = 'active' and o.deleted_at is null
      and (m.user_id = auth.uid()::text or (
        coalesce(m.user_id, '') = ''
        and lower(m.user_email) = lower(coalesce(auth.jwt()->>'email', ''))
      ))
      and (m.role = 'owner' or m.permissions ? p_permission)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_org_member(p_organization_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.status = 'active'
      and o.status = 'active'
      and o.deleted_at is null
      and (
        m.user_id = auth.uid()::text
        or lower(m.user_email) = lower(coalesce(auth.jwt()->>'email',''))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.fama_admin_create_company(p_id text, p_name text, p_name_key text, p_slug text, p_plan text, p_member_id text, p_user_id text, p_email text, p_display_name text, p_permissions jsonb, p_actor_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF p_plan NOT IN ('inicial','intermediario','profissional') OR length(trim(p_name)) < 2 OR jsonb_typeof(p_permissions) <> 'array' THEN RAISE EXCEPTION 'Invalid company data' USING ERRCODE = '22023'; END IF;
 INSERT INTO public.organizations (id,name,name_key,slug,status,plan,plan_status,plan_expires_at,billing_enabled,block_on_expiry,created_by_user_id)
 VALUES (p_id,p_name,p_name_key,p_slug,'active',p_plan,'active','',false,false,p_user_id);
 INSERT INTO public.organization_members (id,organization_id,user_id,user_email,display_name,role,status,permissions)
 VALUES (p_member_id,p_id,p_user_id,lower(p_email),p_display_name,'owner','active',p_permissions);
 INSERT INTO public.audit_logs (organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
 VALUES (p_id,p_actor_id,'security','company_created',p_id,jsonb_build_object('billingEnabled',false,'blockOnExpiry',false));
 RETURN jsonb_build_object('id',p_id,'memberId',p_member_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fama_audit_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'vault', 'extensions', 'pg_temp'
AS $function$
declare
  row_data jsonb;
  previous_data jsonb;
  resolved_organization_id text;
  resolved_record_id text;
  metadata_value jsonb;
  recovery_key text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_data := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  resolved_organization_id := coalesce(
    nullif(row_data->>'organization_id', ''),
    case when tg_table_name = 'organizations' then nullif(row_data->>'id', '') else null end
  );
  resolved_record_id := coalesce(row_data->>'id', '');

  metadata_value := jsonb_strip_nulls(jsonb_build_object(
    'operation', lower(tg_op),
    'status_before', case when previous_data is null then null else previous_data->>'status' end,
    'status_after', case when tg_op = 'DELETE' then null else row_data->>'status' end
  ));

  insert into public.audit_logs (
    organization_id, actor_user_id, event_type, entity_type, record_id, metadata
  ) values (
    resolved_organization_id, auth.uid()::text, lower(tg_op), tg_table_name, resolved_record_id, metadata_value
  );

  if tg_op = 'DELETE'
     and tg_table_name = any(array['leads','quotes','appointments','work_orders','customers','inventory_items','transactions','employees','warranties','contracts','attachments','organization_members'])
     and coalesce(resolved_organization_id,'') <> ''
     and coalesce(resolved_record_id,'') <> '' then
    select decrypted_secret into recovery_key
    from vault.decrypted_secrets
    where name='fama_recovery_key'
    order by created_at desc
    limit 1;

    if recovery_key is not null then
      insert into public.recovery_snapshots (
        id, organization_id, entity_type, record_id, encrypted_payload,
        deleted_by_user_id, deleted_at, expires_at
      ) values (
        gen_random_uuid()::text,
        resolved_organization_id,
        tg_table_name,
        resolved_record_id,
        encode(extensions.pgp_sym_encrypt(row_data::text,recovery_key,'cipher-algo=aes256,compress-algo=1'),'base64'),
        coalesce(auth.uid()::text,''),
        now(),
        now() + interval '30 days'
      );
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_consume_rate_limit(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  allowed boolean;
  effective_limit integer;
begin
  if p_key_hash is null or length(p_key_hash) < 16
     or p_action is null or length(p_action) < 2
     or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  effective_limit := case
    when p_action = 'control_auth_login' then greatest(p_limit, 8)
    else p_limit
  end;

  insert into public.request_rate_limits (
    key_hash, action, window_started_at, request_count, updated_at
  ) values (
    p_key_hash, p_action, now(), 1, now()
  )
  on conflict (key_hash, action) do update set
    request_count = case
      when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else public.request_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else public.request_rate_limits.window_started_at
    end,
    updated_at = now()
  returning request_count <= effective_limit into allowed;

  return allowed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_control_auth_directory()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id::text,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'is_anonymous', u.is_anonymous,
    'mfa_verified', coalesce((select count(*) from auth.mfa_factors f where f.user_id=u.id and f.status::text='verified'),0),
    'sessions', coalesce((select count(*) from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after > now())),0)
  ) order by u.created_at), '[]'::jsonb)
  from auth.users u;
$function$;

CREATE OR REPLACE FUNCTION public.fama_control_health()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'database_size_bytes', pg_database_size(current_database()),
    'organizations_total', (select count(*) from public.organizations),
    'organizations_active', (select count(*) from public.organizations where status='active' and deleted_at is null),
    'organizations_suspended', (select count(*) from public.organizations where status='suspended' and deleted_at is null),
    'organizations_deleted', (select count(*) from public.organizations where status='deleted' or deleted_at is not null),
    'members_total', (select count(*) from public.organization_members),
    'members_active', (select count(*) from public.organization_members where status='active'),
    'auth_users', (select count(*) from auth.users),
    'active_sessions', (select count(*) from auth.sessions where not_after is null or not_after > now()),
    'mfa_verified', (select count(*) from auth.mfa_factors where status::text='verified'),
    'audit_events', (select count(*) from public.audit_logs),
    'privacy_open', (select count(*) from public.privacy_requests where status in ('open','in_progress')),
    'recovery_items', (select count(*) from public.recovery_snapshots where restored_at is null and expires_at > now()),
    'protected_records', (select count(*) from public.protected_records),
    'backups', (select count(*) from public.fama_control_backups),
    'storage_bucket', coalesce((select jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) from storage.buckets where id='fama-documents' limit 1), '{}'::jsonb),
    'orphan_members', (select count(*) from public.organization_members m where nullif(m.user_id,'') is not null and not exists (select 1 from auth.users u where u.id::text=m.user_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.fama_control_restore_backup(p_backup_id text, p_actor_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  b public.fama_control_backups%rowtype;
  data jsonb;
  t text;
  row_data jsonb;
  update_clause text;
  sql_text text;
  restored_rows bigint := 0;
  table_rows bigint;
  restore_order text[] := array[
    'organizations','organization_members','customers','employees','service_price_catalog','maintenance_plans',
    'customer_subscriptions','leads','quotes','appointments','work_orders','water_tests','followups','referrals',
    'equipment_assets','equipment_maintenance_logs','inventory_items','work_order_items','inventory_movements',
    'transactions','employee_commissions','customer_feedback','service_reports','pool_issue_history',
    'chemical_dosage_rules','fama_settings','warranties','contracts','attachments','legal_consents','privacy_requests','recovery_snapshots'
  ];
begin
  select * into b from public.fama_control_backups where id=p_backup_id for update;
  if not found then raise exception 'BACKUP_NOT_FOUND'; end if;
  if public.fama_jsonb_sha256(b.payload) <> b.checksum then raise exception 'BACKUP_CHECKSUM_MISMATCH'; end if;
  if coalesce(b.payload->>'format','') <> 'fama-control-backup' then raise exception 'BACKUP_FORMAT_INVALID'; end if;
  data := coalesce(b.payload->'data','{}'::jsonb);
  if b.scope='global' then delete from public.protected_records;
  elsif b.organization_id is not null then delete from public.protected_records where organization_id=b.organization_id;
  end if;
  foreach t in array restore_order loop
    if jsonb_typeof(data->t) <> 'array' then continue; end if;
    if t <> 'organization_members' then
      select string_agg(format('%I = excluded.%I',a.attname,a.attname),', ' order by a.attnum)
      into update_clause
      from pg_attribute a
      where a.attrelid = format('public.%I',t)::regclass and a.attnum>0 and not a.attisdropped and a.attname<>'id';
    end if;
    table_rows := 0;
    for row_data in select value from jsonb_array_elements(data->t) loop
      if t='organization_members' then
        update public.organization_members m
        set user_id=r.user_id,user_email=r.user_email,display_name=r.display_name,role=r.role,status=r.status,
            created_at=r.created_at,updated_at=r.updated_at,permissions=r.permissions
        from jsonb_populate_record(null::public.organization_members,row_data) r
        where m.id=r.id or (m.organization_id=r.organization_id and lower(m.user_email)=lower(r.user_email));
        if not found then insert into public.organization_members select * from jsonb_populate_record(null::public.organization_members,row_data); end if;
      else
        sql_text := format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) on conflict (id) do update set %s',t,t,update_clause);
        execute sql_text using row_data;
      end if;
      table_rows := table_rows + 1;
    end loop;
    restored_rows := restored_rows + table_rows;
  end loop;
  if jsonb_typeof(data->'protected_records')='array' then
    t := 'protected_records';
    select string_agg(format('%I = excluded.%I',a.attname,a.attname),', ' order by a.attnum)
    into update_clause
    from pg_attribute a
    where a.attrelid='public.protected_records'::regclass and a.attnum>0 and not a.attisdropped and a.attname<>'id';
    for row_data in select value from jsonb_array_elements(data->'protected_records') loop
      sql_text := format('insert into public.protected_records select * from jsonb_populate_record(null::public.protected_records,$1) on conflict (id) do update set %s',update_clause);
      execute sql_text using row_data;
      restored_rows := restored_rows + 1;
    end loop;
  end if;
  update public.fama_control_backups set restored_at=now(),restored_by_user_id=p_actor_user_id where id=p_backup_id;
  insert into public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
  values(b.organization_id,p_actor_user_id,'restore','fama_control_backup',p_backup_id,
    jsonb_build_object('scope',b.scope,'checksum',b.checksum,'atomic',true,'restored_rows',restored_rows));
  return jsonb_build_object('restored',true,'atomic',true,'restored_rows',restored_rows);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_control_restore_snapshot(p_snapshot_id text, p_actor_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'extensions', 'pg_temp'
AS $function$
declare
  s public.recovery_snapshots%rowtype;
  recovery_key text;
  payload jsonb;
  exists_now boolean;
  member_row public.organization_members%rowtype;
begin
  select * into s from public.recovery_snapshots where id=p_snapshot_id for update;
  if not found then raise exception 'SNAPSHOT_NOT_FOUND'; end if;
  if s.restored_at is not null then raise exception 'SNAPSHOT_ALREADY_RESTORED'; end if;
  if s.expires_at <= now() then raise exception 'SNAPSHOT_EXPIRED'; end if;
  if s.encrypted_payload like 'fama:v1:%' then raise exception 'SNAPSHOT_LEGADO_NAO_COMPATIVEL'; end if;
  if not (s.entity_type = any(array['leads','quotes','appointments','work_orders','customers','inventory_items','transactions','employees','warranties','contracts','attachments','organization_members'])) then
    raise exception 'ENTITY_NOT_RESTORABLE';
  end if;

  select decrypted_secret into recovery_key
  from vault.decrypted_secrets where name='fama_recovery_key'
  order by created_at desc limit 1;
  if recovery_key is null then raise exception 'RECOVERY_KEY_MISSING'; end if;

  payload := extensions.pgp_sym_decrypt(decode(s.encrypted_payload,'base64'),recovery_key)::jsonb;

  if s.entity_type = 'organization_members' then
    select * into member_row from jsonb_populate_record(null::public.organization_members,payload);

    update public.organization_members m
    set user_id = member_row.user_id,
        user_email = member_row.user_email,
        display_name = member_row.display_name,
        role = member_row.role,
        status = member_row.status,
        created_at = member_row.created_at,
        updated_at = member_row.updated_at,
        permissions = member_row.permissions
    where m.id = member_row.id
       or (m.organization_id = member_row.organization_id and lower(m.user_email) = lower(member_row.user_email));

    if not found then
      insert into public.organization_members
      select * from jsonb_populate_record(null::public.organization_members,payload);
    end if;
  else
    execute format('select exists(select 1 from public.%I where id=$1)',s.entity_type) into exists_now using s.record_id;
    if exists_now then raise exception 'RECORD_ALREADY_EXISTS'; end if;
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',s.entity_type,s.entity_type) using payload;
  end if;

  update public.recovery_snapshots
  set restored_at=now(), restored_by_user_id=p_actor_user_id
  where id=p_snapshot_id;

  insert into public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
  values(s.organization_id,p_actor_user_id,'restore',s.entity_type,s.record_id,jsonb_build_object('snapshot_id',s.id,'upsert_safe',s.entity_type='organization_members'));

  return jsonb_build_object('restored',true,'entity_type',s.entity_type,'record_id',s.record_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_finalize_work_order(p_organization_id text, p_work_order_id text, p_actor_user_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  i record;
  product_cost bigint := 0;
  wo public.work_orders%rowtype;
  movement_id text;
begin
  select * into wo from public.work_orders where id=p_work_order_id and organization_id=p_organization_id for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  for i in select * from public.work_order_items where organization_id=p_organization_id and work_order_id=p_work_order_id and applied=false for update loop
    product_cost := product_cost + round(i.quantity * i.unit_cost_cents)::bigint;
    if i.inventory_item_id is not null and i.inventory_item_id<>'' then
      update public.inventory_items set quantity=quantity-i.quantity,updated_at=now()
      where id=i.inventory_item_id and organization_id=p_organization_id;
      movement_id := gen_random_uuid()::text;
      insert into public.inventory_movements(id,organization_id,inventory_item_id,work_order_id,movement_type,quantity,unit_cost_cents,note)
      values(movement_id,p_organization_id,i.inventory_item_id,p_work_order_id,'saida',-i.quantity,i.unit_cost_cents,'Baixa automática ao finalizar OS');
    end if;
    update public.work_order_items set applied=true,updated_at=now() where id=i.id;
  end loop;
  update public.work_orders
  set status='executado',completed_at=now(),product_cost_cents=product_cost,
      gross_profit_cents=amount_cents-product_cost-coalesce(labor_cost_cents,0)-coalesce(travel_cost_cents,0),updated_at=now()
  where id=p_work_order_id and organization_id=p_organization_id;
  insert into public.audit_logs(organization_id,actor_user_id,event_type,entity_type,record_id,metadata)
  values(p_organization_id,p_actor_user_id,'update','work_orders',p_work_order_id,
    jsonb_build_object('action','finalize','automatic_inventory',true,'product_cost_cents',product_cost));
  return jsonb_build_object('ok',true,'work_order_id',p_work_order_id,'product_cost_cents',product_cost);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_jsonb_sha256(p_payload jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'pg_temp'
AS $function$
  select encode(extensions.digest(convert_to(coalesce(p_payload,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
$function$;

CREATE OR REPLACE FUNCTION public.fama_record_protection_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org text;
  v_id text;
begin
  v_org := coalesce(case when tg_op='DELETE' then old.organization_id else new.organization_id end, '');
  v_id := coalesce(case when tg_op='DELETE' then old.id else new.id end, '');
  if v_org <> '' and v_id <> '' and exists (
    select 1 from public.protected_records p
    where p.organization_id=v_org and p.entity_type=tg_table_name and p.record_id=v_id
  ) then
    raise exception 'RECORD_PROTECTED';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fama_system_dashboard(p_organization_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
select jsonb_build_object(
  'leads_total', (select count(*) from public.leads where organization_id=p_organization_id),
  'leads_open', (select count(*) from public.leads where organization_id=p_organization_id and status not in ('ganho','perdido')),
  'quotes_total', (select count(*) from public.quotes where organization_id=p_organization_id),
  'quotes_approved', (select count(*) from public.quotes where organization_id=p_organization_id and status='aprovado'),
  'quotes_value_cents', coalesce((select sum(total_cents) from public.quotes where organization_id=p_organization_id and status='aprovado'),0),
  'appointments_total', (select count(*) from public.appointments where organization_id=p_organization_id),
  'appointments_open', (select count(*) from public.appointments where organization_id=p_organization_id and status not in ('concluido','cancelado')),
  'orders_total', (select count(*) from public.work_orders where organization_id=p_organization_id),
  'orders_open', (select count(*) from public.work_orders where organization_id=p_organization_id and status not in ('concluida','cancelada')),
  'warranties_active', (select count(*) from public.warranties where organization_id=p_organization_id and status in ('ativa','acionada','agendada')),
  'customers_active', (select count(*) from public.customers where organization_id=p_organization_id and status='ativo'),
  'contracts_active', (select count(*) from public.contracts where organization_id=p_organization_id and status='ativo'),
  'inventory_low', (select count(*) from public.inventory_items where organization_id=p_organization_id and quantity <= minimum_quantity),
  'finance_pending_cents', coalesce((select sum(case when type='receita' then amount_cents else -amount_cents end) from public.transactions where organization_id=p_organization_id and status in ('pendente','atrasado')),0),
  'employees_active', (select count(*) from public.employees where organization_id=p_organization_id and active=true)
);
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_warranty(p_organization_id text, p_warranty_id text, p_scheduled_at text, p_technician text, p_appointment_id text, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  warranty_row public.warranties%rowtype;
  appointment_row public.appointments%rowtype;
  resolved_appointment_id text;
begin
  select * into warranty_row
  from public.warranties
  where id = p_warranty_id and organization_id = p_organization_id
  for update;

  if warranty_row.id is null then
    raise exception 'Garantia não encontrada.' using errcode = 'P0002';
  end if;

  resolved_appointment_id := case when warranty_row.appointment_id <> '' then warranty_row.appointment_id else p_appointment_id end;

  insert into public.appointments (
    id, organization_id, title, client_name, start_at, address, technician, kind, status, notes, created_at, updated_at
  ) values (
    resolved_appointment_id,
    p_organization_id,
    'Atendimento de garantia ' || warranty_row.warranty_number,
    warranty_row.client_name,
    p_scheduled_at,
    '',
    p_technician,
    'Garantia',
    'agendado',
    'Cobertura: ' || warranty_row.item,
    p_now,
    p_now
  )
  on conflict (id) do update set
    title = excluded.title,
    client_name = excluded.client_name,
    start_at = excluded.start_at,
    technician = excluded.technician,
    kind = excluded.kind,
    status = excluded.status,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  returning * into appointment_row;

  update public.warranties set
    scheduled_at = p_scheduled_at,
    appointment_id = resolved_appointment_id,
    technician = p_technician,
    status = 'agendada',
    updated_at = p_now
  where id = p_warranty_id and organization_id = p_organization_id
  returning * into warranty_row;

  return jsonb_build_object('warranty', to_jsonb(warranty_row), 'appointment', to_jsonb(appointment_row));
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$ begin new.updated_at=now(); return new; end; $function$;

CREATE INDEX idx_appointments_org_start_at ON public.appointments USING btree (organization_id, start_at);

CREATE INDEX idx_appointments_route ON public.appointments USING btree (organization_id, technician, start_at, route_order);

CREATE INDEX idx_attachments_record ON public.attachments USING btree (organization_id, entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity_record ON public.audit_logs USING btree (entity_type, record_id, occurred_at DESC);

CREATE INDEX idx_audit_logs_event_time ON public.audit_logs USING btree (event_type, occurred_at DESC);

CREATE INDEX idx_audit_logs_organization_time ON public.audit_logs USING btree (organization_id, occurred_at DESC);

CREATE INDEX idx_bank_accounts_org_name ON public.bank_accounts USING btree (organization_id, name);

CREATE UNIQUE INDEX idx_bank_accounts_provider_account ON public.bank_accounts USING btree (organization_id, provider, provider_connection_id, provider_account_id) WHERE (provider_account_id <> ''::text);

CREATE INDEX idx_bank_connections_org ON public.bank_connections USING btree (organization_id, provider);

CREATE INDEX idx_bank_movements_org_date ON public.bank_movements USING btree (organization_id, posted_at);

CREATE UNIQUE INDEX idx_bank_movements_provider_transaction ON public.bank_movements USING btree (organization_id, account_id, provider, provider_transaction_id) WHERE (provider_transaction_id <> ''::text);

CREATE INDEX idx_chemical_rules_org ON public.chemical_dosage_rules USING btree (organization_id);

CREATE INDEX idx_contracts_org_created_at ON public.contracts USING btree (organization_id, created_at DESC);

CREATE INDEX idx_customer_feedback_org ON public.customer_feedback USING btree (organization_id);

CREATE INDEX idx_subscriptions_org_due ON public.customer_subscriptions USING btree (organization_id, status, next_due_on);

CREATE INDEX idx_customers_org_name ON public.customers USING btree (organization_id, name);

CREATE INDEX idx_commissions_org_month ON public.employee_commissions USING btree (organization_id, reference_month, status);

CREATE INDEX idx_employees_org_name ON public.employees USING btree (organization_id, name);

CREATE INDEX idx_equipment_assets_org ON public.equipment_assets USING btree (organization_id);

CREATE INDEX idx_equipment_logs_equipment ON public.equipment_maintenance_logs USING btree (equipment_id);

CREATE INDEX idx_equipment_logs_org ON public.equipment_maintenance_logs USING btree (organization_id);

CREATE INDEX idx_fama_control_backups_created_at ON public.fama_control_backups USING btree (created_at DESC);

CREATE INDEX idx_fama_control_backups_organization_id ON public.fama_control_backups USING btree (organization_id);

CREATE INDEX idx_followups_appointment ON public.followups USING btree (organization_id, appointment_id, status);

CREATE INDEX idx_followups_org_due ON public.followups USING btree (organization_id, status, due_at);

CREATE INDEX idx_inventory_org_name ON public.inventory_items USING btree (organization_id, name);

CREATE INDEX idx_inventory_movements_item ON public.inventory_movements USING btree (organization_id, inventory_item_id, created_at DESC);

CREATE INDEX idx_leads_org_created_at ON public.leads USING btree (organization_id, created_at DESC);

CREATE INDEX idx_legal_consents_user_version ON public.legal_consents USING btree (user_id, terms_version, privacy_version, accepted_at DESC);

CREATE INDEX idx_maintenance_plans_org ON public.maintenance_plans USING btree (organization_id);

CREATE INDEX idx_org_members_access_email ON public.organization_members USING btree (organization_id, status, lower(user_email));

CREATE INDEX idx_org_members_access_user ON public.organization_members USING btree (organization_id, status, user_id);

CREATE INDEX idx_org_members_organization ON public.organization_members USING btree (organization_id);

CREATE INDEX idx_org_members_user_id ON public.organization_members USING btree (user_id);

CREATE UNIQUE INDEX idx_organizations_billing_payment ON public.organizations USING btree (billing_payment_id) WHERE (billing_payment_id <> ''::text);

CREATE UNIQUE INDEX idx_organizations_name_key ON public.organizations USING btree (name_key) WHERE (status <> 'deleted'::text);

CREATE INDEX idx_pool_issue_customer ON public.pool_issue_history USING btree (organization_id, customer_id, detected_at DESC);

CREATE INDEX idx_pool_quote_calc_org_id ON public.pool_quote_calculations USING btree (organization_id, id);

CREATE INDEX idx_pool_quote_calculations_org ON public.pool_quote_calculations USING btree (organization_id);

CREATE INDEX idx_pool_quote_catalog_inventory ON public.pool_quote_catalog_items USING btree (inventory_item_id) WHERE (inventory_item_id IS NOT NULL);

CREATE INDEX idx_pool_quote_catalog_items_kind ON public.pool_quote_catalog_items USING btree (kind);

CREATE INDEX idx_pool_quote_catalog_items_org ON public.pool_quote_catalog_items USING btree (organization_id);

CREATE INDEX idx_pool_quote_catalog_org_active ON public.pool_quote_catalog_items USING btree (organization_id, active, kind);

CREATE INDEX idx_pool_quote_templates_org_active ON public.pool_quote_templates USING btree (organization_id, active);

CREATE INDEX idx_privacy_requests_organization ON public.privacy_requests USING btree (organization_id, created_at DESC);

CREATE INDEX idx_privacy_requests_requester ON public.privacy_requests USING btree (requester_user_id, created_at DESC);

CREATE INDEX idx_privacy_requests_status ON public.privacy_requests USING btree (status, created_at DESC);

CREATE INDEX idx_protected_records_lookup ON public.protected_records USING btree (organization_id, entity_type, record_id);

CREATE INDEX idx_purchases_org_date ON public.purchases USING btree (organization_id, purchase_date);

CREATE INDEX idx_quotes_employee ON public.quotes USING btree (organization_id, employee_id);

CREATE INDEX idx_quotes_org_created_at ON public.quotes USING btree (organization_id, created_at DESC);

CREATE INDEX idx_recovery_snapshots_available ON public.recovery_snapshots USING btree (organization_id, deleted_at DESC) WHERE (restored_at IS NULL);

CREATE INDEX idx_recovery_snapshots_expiry ON public.recovery_snapshots USING btree (expires_at) WHERE (restored_at IS NULL);

CREATE INDEX idx_referrals_employee ON public.referrals USING btree (organization_id, employee_id);

CREATE INDEX idx_referrals_org ON public.referrals USING btree (organization_id);

CREATE INDEX idx_request_rate_limits_updated ON public.request_rate_limits USING btree (updated_at);

CREATE INDEX idx_service_price_catalog_org ON public.service_price_catalog USING btree (organization_id);

CREATE INDEX idx_service_reports_org ON public.service_reports USING btree (organization_id);

CREATE INDEX idx_suppliers_org_name ON public.suppliers USING btree (organization_id, name);

CREATE INDEX idx_support_tickets_org_created ON public.support_tickets USING btree (organization_id, created_at DESC);

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);

CREATE INDEX idx_transactions_org_due_date ON public.transactions USING btree (organization_id, due_date DESC);

CREATE INDEX idx_transactions_subscription ON public.transactions USING btree (organization_id, subscription_id, due_date);

CREATE INDEX idx_warranties_org_expires_at ON public.warranties USING btree (organization_id, expires_at);

CREATE INDEX idx_water_tests_org_customer ON public.water_tests USING btree (organization_id, customer_id, tested_at DESC);

CREATE INDEX idx_work_order_items_work_order ON public.work_order_items USING btree (organization_id, work_order_id);

CREATE INDEX idx_work_orders_org_scheduled_at ON public.work_orders USING btree (organization_id, scheduled_at DESC);

CREATE TRIGGER fama_audit_appointments AFTER INSERT OR DELETE OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_appointments BEFORE DELETE OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_schedule_next_maintenance AFTER UPDATE OF status ON appointments FOR EACH ROW EXECUTE FUNCTION private.fama_schedule_next_maintenance();

CREATE TRIGGER fama_audit_attachments AFTER INSERT OR DELETE OR UPDATE ON attachments FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_attachments BEFORE DELETE OR UPDATE ON attachments FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON bank_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON bank_movements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON chemical_dosage_rules FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_contracts AFTER INSERT OR DELETE OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_contracts BEFORE DELETE OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON customer_feedback FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON customer_subscriptions FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_customers AFTER INSERT OR DELETE OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_customers BEFORE DELETE OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON employee_commissions FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_employees AFTER INSERT OR DELETE OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_employees BEFORE DELETE OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON equipment_assets FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON equipment_maintenance_logs FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER set_fama_control_admins_updated_at BEFORE UPDATE ON fama_control_admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_enrich_backup_payload BEFORE INSERT ON fama_control_backups FOR EACH ROW EXECUTE FUNCTION private.fama_enrich_backup_payload();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON followups FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_inventory_items AFTER INSERT OR DELETE OR UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_inventory_items BEFORE DELETE OR UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_leads AFTER INSERT OR DELETE OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_leads BEFORE DELETE OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON maintenance_plans FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_organization_members AFTER INSERT OR DELETE OR UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER set_organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fama_audit_organizations AFTER INSERT OR DELETE OR UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON pool_issue_history FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_pool_quote_catalog_items_updated_at BEFORE UPDATE ON pool_quote_catalog_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fama_audit_privacy_requests AFTER INSERT OR DELETE OR UPDATE ON privacy_requests FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER set_privacy_requests_updated_at BEFORE UPDATE ON privacy_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fama_audit_quotes AFTER INSERT OR DELETE OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_quotes BEFORE DELETE OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_sales_commission AFTER UPDATE OF status ON quotes FOR EACH ROW EXECUTE FUNCTION private.fama_sales_commission();

CREATE TRIGGER fama_audit_recovery_snapshots AFTER INSERT OR DELETE OR UPDATE ON recovery_snapshots FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_referral_commission AFTER UPDATE OF status ON referrals FOR EACH ROW EXECUTE FUNCTION private.fama_referral_commission();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON service_price_catalog FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON service_reports FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fama_audit_transactions AFTER INSERT OR DELETE OR UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_transactions BEFORE DELETE OR UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_warranties AFTER INSERT OR DELETE OR UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_warranties BEFORE DELETE OR UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_warranties_updated_at BEFORE UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON water_tests FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON work_order_items FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER fama_audit_work_orders AFTER INSERT OR DELETE OR UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION fama_audit_change();

CREATE TRIGGER fama_protect_work_orders BEFORE DELETE OR UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION fama_record_protection_guard();

CREATE TRIGGER set_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fama_apply_work_order_inventory AFTER UPDATE OF status ON work_orders FOR EACH ROW EXECUTE FUNCTION private.fama_apply_work_order_inventory();

CREATE TRIGGER trg_fama_audit_row_change AFTER INSERT OR DELETE OR UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION private.fama_audit_row_change();

CREATE TRIGGER trg_fama_post_sale_followup AFTER UPDATE OF status ON work_orders FOR EACH ROW EXECUTE FUNCTION private.fama_post_sale_followup();

CREATE TRIGGER trg_fama_service_commission AFTER UPDATE OF status ON work_orders FOR EACH ROW EXECUTE FUNCTION private.fama_service_commission();

ALTER TABLE "private"."frontend_snapshots" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_module_delete" ON "public"."appointments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'agenda'::text));

CREATE POLICY "appointments_module_insert" ON "public"."appointments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'agenda'::text));

CREATE POLICY "appointments_module_select" ON "public"."appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'agenda'::text));

CREATE POLICY "appointments_module_update" ON "public"."appointments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'agenda'::text)) WITH CHECK (private.has_org_permission(organization_id, 'agenda'::text));

ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_module_delete" ON "public"."attachments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'dashboard'::text));

CREATE POLICY "attachments_module_insert" ON "public"."attachments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'dashboard'::text));

CREATE POLICY "attachments_module_select" ON "public"."attachments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'dashboard'::text));

CREATE POLICY "attachments_module_update" ON "public"."attachments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'dashboard'::text)) WITH CHECK (private.has_org_permission(organization_id, 'dashboard'::text));

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_access" ON "public"."audit_logs" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bank_connections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bank_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."chemical_dosage_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chemical_rules_delete" ON "public"."chemical_dosage_rules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "chemical_rules_insert" ON "public"."chemical_dosage_rules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "chemical_rules_select" ON "public"."chemical_dosage_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "chemical_rules_update" ON "public"."chemical_dosage_rules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text)) WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_module_delete" ON "public"."contracts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "contracts_module_insert" ON "public"."contracts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "contracts_module_select" ON "public"."contracts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "contracts_module_update" ON "public"."contracts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text)) WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

ALTER TABLE "public"."customer_feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_feedback_delete" ON "public"."customer_feedback" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customer_feedback_insert" ON "public"."customer_feedback" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customer_feedback_select" ON "public"."customer_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customer_feedback_update" ON "public"."customer_feedback" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text)) WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

ALTER TABLE "public"."customer_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_subscriptions_delete" ON "public"."customer_subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "customer_subscriptions_insert" ON "public"."customer_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "customer_subscriptions_select" ON "public"."customer_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "customer_subscriptions_update" ON "public"."customer_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text)) WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_module_delete" ON "public"."customers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customers_module_insert" ON "public"."customers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customers_module_select" ON "public"."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "customers_module_update" ON "public"."customers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text)) WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

ALTER TABLE "public"."employee_commissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_commissions_delete" ON "public"."employee_commissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employee_commissions_insert" ON "public"."employee_commissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employee_commissions_select" ON "public"."employee_commissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employee_commissions_update" ON "public"."employee_commissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text)) WITH CHECK (private.has_org_permission(organization_id, 'team'::text));

ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_module_delete" ON "public"."employees" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employees_module_insert" ON "public"."employees" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employees_module_select" ON "public"."employees" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text));

CREATE POLICY "employees_module_update" ON "public"."employees" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'team'::text)) WITH CHECK (private.has_org_permission(organization_id, 'team'::text));

ALTER TABLE "public"."equipment_assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_assets_delete" ON "public"."equipment_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_assets_insert" ON "public"."equipment_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_assets_select" ON "public"."equipment_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_assets_update" ON "public"."equipment_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text)) WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

ALTER TABLE "public"."equipment_maintenance_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_logs_delete" ON "public"."equipment_maintenance_logs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_logs_insert" ON "public"."equipment_maintenance_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_logs_select" ON "public"."equipment_maintenance_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "equipment_logs_update" ON "public"."equipment_maintenance_logs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text)) WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

ALTER TABLE "public"."fama_control_admins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fama_control_admins_select_self" ON "public"."fama_control_admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = (( SELECT auth.uid() AS uid))::text) OR (lower(email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

ALTER TABLE "public"."fama_control_backups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_access" ON "public"."fama_control_backups" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "public"."fama_quote_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."fama_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fama_settings_control_admin_select" ON "public"."fama_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM fama_control_admins a
  WHERE ((a.user_id = (( SELECT auth.uid() AS uid))::text) AND (a.enabled = true)))));

ALTER TABLE "public"."followups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followups_delete" ON "public"."followups" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "followups_insert" ON "public"."followups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "followups_select" ON "public"."followups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "followups_update" ON "public"."followups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text)) WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_module_delete" ON "public"."inventory_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_items_module_insert" ON "public"."inventory_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_items_module_select" ON "public"."inventory_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_items_module_update" ON "public"."inventory_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text)) WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_delete" ON "public"."inventory_movements" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_movements_insert" ON "public"."inventory_movements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_movements_select" ON "public"."inventory_movements" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text));

CREATE POLICY "inventory_movements_update" ON "public"."inventory_movements" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'inventory'::text)) WITH CHECK (private.has_org_permission(organization_id, 'inventory'::text));

ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_module_delete" ON "public"."leads" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "leads_module_insert" ON "public"."leads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "leads_module_select" ON "public"."leads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "leads_module_update" ON "public"."leads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text)) WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

ALTER TABLE "public"."legal_consents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_consents_own_insert" ON "public"."legal_consents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = (( SELECT auth.uid() AS uid))::text));

CREATE POLICY "legal_consents_own_select" ON "public"."legal_consents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = (( SELECT auth.uid() AS uid))::text));

CREATE POLICY "legal_consents_own_update" ON "public"."legal_consents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((user_id = (( SELECT auth.uid() AS uid))::text)) WITH CHECK ((user_id = (( SELECT auth.uid() AS uid))::text));

ALTER TABLE "public"."maintenance_plans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_plans_delete" ON "public"."maintenance_plans" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "maintenance_plans_insert" ON "public"."maintenance_plans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "maintenance_plans_select" ON "public"."maintenance_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text));

CREATE POLICY "maintenance_plans_update" ON "public"."maintenance_plans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'contracts'::text)) WITH CHECK (private.has_org_permission(organization_id, 'contracts'::text));

ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_members_select_self" ON "public"."organization_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = (( SELECT auth.uid() AS uid))::text) OR (lower(user_email) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_member" ON "public"."organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.is_org_member(id));

ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pool_issue_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_issue_history_delete" ON "public"."pool_issue_history" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "pool_issue_history_insert" ON "public"."pool_issue_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "pool_issue_history_select" ON "public"."pool_issue_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text));

CREATE POLICY "pool_issue_history_update" ON "public"."pool_issue_history" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'customers'::text)) WITH CHECK (private.has_org_permission(organization_id, 'customers'::text));

ALTER TABLE "public"."pool_quote_calculations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_quote_calculations_insert_members" ON "public"."pool_quote_calculations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_calculations.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text)))));

CREATE POLICY "pool_quote_calculations_select_members" ON "public"."pool_quote_calculations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_calculations.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text)))));

ALTER TABLE "public"."pool_quote_catalog_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_quote_catalog_items_members" ON "public"."pool_quote_catalog_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_catalog_items.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_catalog_items.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text)))));

ALTER TABLE "public"."pool_quote_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_quote_templates_delete_admin" ON "public"."pool_quote_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_templates.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "pool_quote_templates_insert_admin" ON "public"."pool_quote_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_templates.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "pool_quote_templates_select_members" ON "public"."pool_quote_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_templates.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text) AND ((m.role = 'owner'::text) OR (COALESCE(m.permissions, '[]'::jsonb) ? 'quotes'::text))))));

CREATE POLICY "pool_quote_templates_update_admin" ON "public"."pool_quote_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_templates.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = pool_quote_templates.organization_id) AND (m.user_id = (( SELECT auth.uid() AS uid))::text) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

ALTER TABLE "public"."privacy_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_requests_own_insert" ON "public"."privacy_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((requester_user_id = (( SELECT auth.uid() AS uid))::text) AND ((organization_id IS NULL) OR private.is_org_member(organization_id))));

CREATE POLICY "privacy_requests_own_select" ON "public"."privacy_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((requester_user_id = (( SELECT auth.uid() AS uid))::text));

ALTER TABLE "public"."protected_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_access" ON "public"."protected_records" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_module_delete" ON "public"."quotes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "quotes_module_insert" ON "public"."quotes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "quotes_module_select" ON "public"."quotes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "quotes_module_update" ON "public"."quotes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text)) WITH CHECK (private.has_org_permission(organization_id, 'quotes'::text));

ALTER TABLE "public"."recovery_snapshots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_access" ON "public"."recovery_snapshots" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_delete" ON "public"."referrals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "referrals_insert" ON "public"."referrals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "referrals_select" ON "public"."referrals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text));

CREATE POLICY "referrals_update" ON "public"."referrals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'crm'::text)) WITH CHECK (private.has_org_permission(organization_id, 'crm'::text));

ALTER TABLE "public"."request_rate_limits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_access" ON "public"."request_rate_limits" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "public"."service_price_catalog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_price_catalog_delete" ON "public"."service_price_catalog" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "service_price_catalog_insert" ON "public"."service_price_catalog" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "service_price_catalog_select" ON "public"."service_price_catalog" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text));

CREATE POLICY "service_price_catalog_update" ON "public"."service_price_catalog" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'quotes'::text)) WITH CHECK (private.has_org_permission(organization_id, 'quotes'::text));

ALTER TABLE "public"."service_reports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_reports_delete" ON "public"."service_reports" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "service_reports_insert" ON "public"."service_reports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "service_reports_select" ON "public"."service_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "service_reports_update" ON "public"."service_reports" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text)) WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_module_delete" ON "public"."transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'finance'::text));

CREATE POLICY "transactions_module_insert" ON "public"."transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'finance'::text));

CREATE POLICY "transactions_module_select" ON "public"."transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'finance'::text));

CREATE POLICY "transactions_module_update" ON "public"."transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'finance'::text)) WITH CHECK (private.has_org_permission(organization_id, 'finance'::text));

ALTER TABLE "public"."warranties" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warranties_module_delete" ON "public"."warranties" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'warranties'::text));

CREATE POLICY "warranties_module_insert" ON "public"."warranties" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'warranties'::text));

CREATE POLICY "warranties_module_select" ON "public"."warranties" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'warranties'::text));

CREATE POLICY "warranties_module_update" ON "public"."warranties" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'warranties'::text)) WITH CHECK (private.has_org_permission(organization_id, 'warranties'::text));

ALTER TABLE "public"."water_tests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_tests_delete" ON "public"."water_tests" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "water_tests_insert" ON "public"."water_tests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "water_tests_select" ON "public"."water_tests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "water_tests_update" ON "public"."water_tests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text)) WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

ALTER TABLE "public"."work_order_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_order_items_delete" ON "public"."work_order_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_order_items_insert" ON "public"."work_order_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_order_items_select" ON "public"."work_order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_order_items_update" ON "public"."work_order_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text)) WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_orders_module_delete" ON "public"."work_orders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_orders_module_insert" ON "public"."work_orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_orders_module_select" ON "public"."work_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text));

CREATE POLICY "work_orders_module_update" ON "public"."work_orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.has_org_permission(organization_id, 'orders'::text)) WITH CHECK (private.has_org_permission(organization_id, 'orders'::text));

REVOKE ALL ON SCHEMA "private" FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA "private" TO "postgres";

GRANT CREATE ON SCHEMA "private" TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT USAGE ON SCHEMA "private" TO "service_role";

REVOKE ALL ON SCHEMA "public" FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA "public" TO "pg_database_owner";

GRANT CREATE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON TABLE "private"."frontend_snapshots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."appointments" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."appointments" TO "postgres";

GRANT SELECT ON TABLE "public"."appointments" TO "postgres";

GRANT UPDATE ON TABLE "public"."appointments" TO "postgres";

GRANT DELETE ON TABLE "public"."appointments" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."appointments" TO "postgres";

GRANT REFERENCES ON TABLE "public"."appointments" TO "postgres";

GRANT TRIGGER ON TABLE "public"."appointments" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."appointments" TO "postgres";

GRANT INSERT ON TABLE "public"."appointments" TO "service_role";

GRANT SELECT ON TABLE "public"."appointments" TO "service_role";

GRANT UPDATE ON TABLE "public"."appointments" TO "service_role";

GRANT DELETE ON TABLE "public"."appointments" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."appointments" TO "service_role";

GRANT REFERENCES ON TABLE "public"."appointments" TO "service_role";

GRANT TRIGGER ON TABLE "public"."appointments" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."appointments" TO "service_role";

GRANT INSERT ON TABLE "public"."appointments" TO "authenticated";

GRANT SELECT ON TABLE "public"."appointments" TO "authenticated";

GRANT UPDATE ON TABLE "public"."appointments" TO "authenticated";

GRANT DELETE ON TABLE "public"."appointments" TO "authenticated";

REVOKE ALL ON TABLE "public"."attachments" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."attachments" TO "postgres";

GRANT SELECT ON TABLE "public"."attachments" TO "postgres";

GRANT UPDATE ON TABLE "public"."attachments" TO "postgres";

GRANT DELETE ON TABLE "public"."attachments" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."attachments" TO "postgres";

GRANT REFERENCES ON TABLE "public"."attachments" TO "postgres";

GRANT TRIGGER ON TABLE "public"."attachments" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."attachments" TO "postgres";

GRANT INSERT ON TABLE "public"."attachments" TO "service_role";

GRANT SELECT ON TABLE "public"."attachments" TO "service_role";

GRANT UPDATE ON TABLE "public"."attachments" TO "service_role";

GRANT DELETE ON TABLE "public"."attachments" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."attachments" TO "service_role";

GRANT REFERENCES ON TABLE "public"."attachments" TO "service_role";

GRANT TRIGGER ON TABLE "public"."attachments" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."attachments" TO "service_role";

GRANT INSERT ON TABLE "public"."attachments" TO "authenticated";

GRANT SELECT ON TABLE "public"."attachments" TO "authenticated";

GRANT UPDATE ON TABLE "public"."attachments" TO "authenticated";

GRANT DELETE ON TABLE "public"."attachments" TO "authenticated";

REVOKE ALL ON TABLE "public"."audit_logs" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."audit_logs" TO "postgres";

GRANT SELECT ON TABLE "public"."audit_logs" TO "postgres";

GRANT UPDATE ON TABLE "public"."audit_logs" TO "postgres";

GRANT DELETE ON TABLE "public"."audit_logs" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."audit_logs" TO "postgres";

GRANT REFERENCES ON TABLE "public"."audit_logs" TO "postgres";

GRANT TRIGGER ON TABLE "public"."audit_logs" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."audit_logs" TO "postgres";

GRANT INSERT ON TABLE "public"."audit_logs" TO "service_role";

GRANT SELECT ON TABLE "public"."audit_logs" TO "service_role";

GRANT UPDATE ON TABLE "public"."audit_logs" TO "service_role";

GRANT DELETE ON TABLE "public"."audit_logs" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."audit_logs" TO "service_role";

GRANT REFERENCES ON TABLE "public"."audit_logs" TO "service_role";

GRANT TRIGGER ON TABLE "public"."audit_logs" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."audit_logs" TO "service_role";

REVOKE ALL ON TABLE "public"."bank_accounts" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."bank_accounts" TO "postgres";

GRANT SELECT ON TABLE "public"."bank_accounts" TO "postgres";

GRANT UPDATE ON TABLE "public"."bank_accounts" TO "postgres";

GRANT DELETE ON TABLE "public"."bank_accounts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."bank_accounts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."bank_accounts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."bank_accounts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."bank_accounts" TO "postgres";

GRANT INSERT ON TABLE "public"."bank_accounts" TO "service_role";

GRANT SELECT ON TABLE "public"."bank_accounts" TO "service_role";

GRANT UPDATE ON TABLE "public"."bank_accounts" TO "service_role";

GRANT DELETE ON TABLE "public"."bank_accounts" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."bank_accounts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."bank_accounts" TO "service_role";

GRANT TRIGGER ON TABLE "public"."bank_accounts" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."bank_accounts" TO "service_role";

REVOKE ALL ON TABLE "public"."bank_connections" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."bank_connections" TO "postgres";

GRANT SELECT ON TABLE "public"."bank_connections" TO "postgres";

GRANT UPDATE ON TABLE "public"."bank_connections" TO "postgres";

GRANT DELETE ON TABLE "public"."bank_connections" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."bank_connections" TO "postgres";

GRANT REFERENCES ON TABLE "public"."bank_connections" TO "postgres";

GRANT TRIGGER ON TABLE "public"."bank_connections" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."bank_connections" TO "postgres";

GRANT INSERT ON TABLE "public"."bank_connections" TO "service_role";

GRANT SELECT ON TABLE "public"."bank_connections" TO "service_role";

GRANT UPDATE ON TABLE "public"."bank_connections" TO "service_role";

GRANT DELETE ON TABLE "public"."bank_connections" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."bank_connections" TO "service_role";

GRANT REFERENCES ON TABLE "public"."bank_connections" TO "service_role";

GRANT TRIGGER ON TABLE "public"."bank_connections" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."bank_connections" TO "service_role";

REVOKE ALL ON TABLE "public"."bank_movements" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."bank_movements" TO "postgres";

GRANT SELECT ON TABLE "public"."bank_movements" TO "postgres";

GRANT UPDATE ON TABLE "public"."bank_movements" TO "postgres";

GRANT DELETE ON TABLE "public"."bank_movements" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."bank_movements" TO "postgres";

GRANT REFERENCES ON TABLE "public"."bank_movements" TO "postgres";

GRANT TRIGGER ON TABLE "public"."bank_movements" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."bank_movements" TO "postgres";

GRANT INSERT ON TABLE "public"."bank_movements" TO "service_role";

GRANT SELECT ON TABLE "public"."bank_movements" TO "service_role";

GRANT UPDATE ON TABLE "public"."bank_movements" TO "service_role";

GRANT DELETE ON TABLE "public"."bank_movements" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."bank_movements" TO "service_role";

GRANT REFERENCES ON TABLE "public"."bank_movements" TO "service_role";

GRANT TRIGGER ON TABLE "public"."bank_movements" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."bank_movements" TO "service_role";

REVOKE ALL ON TABLE "public"."chemical_dosage_rules" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT SELECT ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT UPDATE ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT DELETE ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT REFERENCES ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT TRIGGER ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."chemical_dosage_rules" TO "postgres";

GRANT INSERT ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT SELECT ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT UPDATE ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT DELETE ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT REFERENCES ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT TRIGGER ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."chemical_dosage_rules" TO "service_role";

GRANT INSERT ON TABLE "public"."chemical_dosage_rules" TO "authenticated";

GRANT SELECT ON TABLE "public"."chemical_dosage_rules" TO "authenticated";

GRANT UPDATE ON TABLE "public"."chemical_dosage_rules" TO "authenticated";

GRANT DELETE ON TABLE "public"."chemical_dosage_rules" TO "authenticated";

REVOKE ALL ON TABLE "public"."contracts" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."contracts" TO "postgres";

GRANT SELECT ON TABLE "public"."contracts" TO "postgres";

GRANT UPDATE ON TABLE "public"."contracts" TO "postgres";

GRANT DELETE ON TABLE "public"."contracts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."contracts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."contracts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."contracts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."contracts" TO "postgres";

GRANT INSERT ON TABLE "public"."contracts" TO "service_role";

GRANT SELECT ON TABLE "public"."contracts" TO "service_role";

GRANT UPDATE ON TABLE "public"."contracts" TO "service_role";

GRANT DELETE ON TABLE "public"."contracts" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."contracts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."contracts" TO "service_role";

GRANT TRIGGER ON TABLE "public"."contracts" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."contracts" TO "service_role";

GRANT INSERT ON TABLE "public"."contracts" TO "authenticated";

GRANT SELECT ON TABLE "public"."contracts" TO "authenticated";

GRANT UPDATE ON TABLE "public"."contracts" TO "authenticated";

GRANT DELETE ON TABLE "public"."contracts" TO "authenticated";

REVOKE ALL ON TABLE "public"."customer_feedback" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."customer_feedback" TO "postgres";

GRANT SELECT ON TABLE "public"."customer_feedback" TO "postgres";

GRANT UPDATE ON TABLE "public"."customer_feedback" TO "postgres";

GRANT DELETE ON TABLE "public"."customer_feedback" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."customer_feedback" TO "postgres";

GRANT REFERENCES ON TABLE "public"."customer_feedback" TO "postgres";

GRANT TRIGGER ON TABLE "public"."customer_feedback" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."customer_feedback" TO "postgres";

GRANT INSERT ON TABLE "public"."customer_feedback" TO "service_role";

GRANT SELECT ON TABLE "public"."customer_feedback" TO "service_role";

GRANT UPDATE ON TABLE "public"."customer_feedback" TO "service_role";

GRANT DELETE ON TABLE "public"."customer_feedback" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."customer_feedback" TO "service_role";

GRANT REFERENCES ON TABLE "public"."customer_feedback" TO "service_role";

GRANT TRIGGER ON TABLE "public"."customer_feedback" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."customer_feedback" TO "service_role";

GRANT INSERT ON TABLE "public"."customer_feedback" TO "authenticated";

GRANT SELECT ON TABLE "public"."customer_feedback" TO "authenticated";

GRANT UPDATE ON TABLE "public"."customer_feedback" TO "authenticated";

GRANT DELETE ON TABLE "public"."customer_feedback" TO "authenticated";

REVOKE ALL ON TABLE "public"."customer_subscriptions" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT SELECT ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT UPDATE ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT DELETE ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."customer_subscriptions" TO "postgres";

GRANT INSERT ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT SELECT ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT UPDATE ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT DELETE ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."customer_subscriptions" TO "service_role";

GRANT INSERT ON TABLE "public"."customer_subscriptions" TO "authenticated";

GRANT SELECT ON TABLE "public"."customer_subscriptions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."customer_subscriptions" TO "authenticated";

GRANT DELETE ON TABLE "public"."customer_subscriptions" TO "authenticated";

REVOKE ALL ON TABLE "public"."customers" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."customers" TO "postgres";

GRANT SELECT ON TABLE "public"."customers" TO "postgres";

GRANT UPDATE ON TABLE "public"."customers" TO "postgres";

GRANT DELETE ON TABLE "public"."customers" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."customers" TO "postgres";

GRANT REFERENCES ON TABLE "public"."customers" TO "postgres";

GRANT TRIGGER ON TABLE "public"."customers" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."customers" TO "postgres";

GRANT INSERT ON TABLE "public"."customers" TO "service_role";

GRANT SELECT ON TABLE "public"."customers" TO "service_role";

GRANT UPDATE ON TABLE "public"."customers" TO "service_role";

GRANT DELETE ON TABLE "public"."customers" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."customers" TO "service_role";

GRANT REFERENCES ON TABLE "public"."customers" TO "service_role";

GRANT TRIGGER ON TABLE "public"."customers" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."customers" TO "service_role";

GRANT INSERT ON TABLE "public"."customers" TO "authenticated";

GRANT SELECT ON TABLE "public"."customers" TO "authenticated";

GRANT UPDATE ON TABLE "public"."customers" TO "authenticated";

GRANT DELETE ON TABLE "public"."customers" TO "authenticated";

REVOKE ALL ON TABLE "public"."employee_commissions" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."employee_commissions" TO "postgres";

GRANT SELECT ON TABLE "public"."employee_commissions" TO "postgres";

GRANT UPDATE ON TABLE "public"."employee_commissions" TO "postgres";

GRANT DELETE ON TABLE "public"."employee_commissions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."employee_commissions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."employee_commissions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."employee_commissions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."employee_commissions" TO "postgres";

GRANT INSERT ON TABLE "public"."employee_commissions" TO "service_role";

GRANT SELECT ON TABLE "public"."employee_commissions" TO "service_role";

GRANT UPDATE ON TABLE "public"."employee_commissions" TO "service_role";

GRANT DELETE ON TABLE "public"."employee_commissions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."employee_commissions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."employee_commissions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."employee_commissions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."employee_commissions" TO "service_role";

GRANT INSERT ON TABLE "public"."employee_commissions" TO "authenticated";

GRANT SELECT ON TABLE "public"."employee_commissions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."employee_commissions" TO "authenticated";

GRANT DELETE ON TABLE "public"."employee_commissions" TO "authenticated";

REVOKE ALL ON TABLE "public"."employees" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."employees" TO "postgres";

GRANT SELECT ON TABLE "public"."employees" TO "postgres";

GRANT UPDATE ON TABLE "public"."employees" TO "postgres";

GRANT DELETE ON TABLE "public"."employees" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."employees" TO "postgres";

GRANT REFERENCES ON TABLE "public"."employees" TO "postgres";

GRANT TRIGGER ON TABLE "public"."employees" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."employees" TO "postgres";

GRANT INSERT ON TABLE "public"."employees" TO "service_role";

GRANT SELECT ON TABLE "public"."employees" TO "service_role";

GRANT UPDATE ON TABLE "public"."employees" TO "service_role";

GRANT DELETE ON TABLE "public"."employees" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."employees" TO "service_role";

GRANT REFERENCES ON TABLE "public"."employees" TO "service_role";

GRANT TRIGGER ON TABLE "public"."employees" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."employees" TO "service_role";

GRANT INSERT ON TABLE "public"."employees" TO "authenticated";

GRANT SELECT ON TABLE "public"."employees" TO "authenticated";

GRANT UPDATE ON TABLE "public"."employees" TO "authenticated";

GRANT DELETE ON TABLE "public"."employees" TO "authenticated";

REVOKE ALL ON TABLE "public"."equipment_assets" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."equipment_assets" TO "postgres";

GRANT SELECT ON TABLE "public"."equipment_assets" TO "postgres";

GRANT UPDATE ON TABLE "public"."equipment_assets" TO "postgres";

GRANT DELETE ON TABLE "public"."equipment_assets" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."equipment_assets" TO "postgres";

GRANT REFERENCES ON TABLE "public"."equipment_assets" TO "postgres";

GRANT TRIGGER ON TABLE "public"."equipment_assets" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."equipment_assets" TO "postgres";

GRANT INSERT ON TABLE "public"."equipment_assets" TO "service_role";

GRANT SELECT ON TABLE "public"."equipment_assets" TO "service_role";

GRANT UPDATE ON TABLE "public"."equipment_assets" TO "service_role";

GRANT DELETE ON TABLE "public"."equipment_assets" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."equipment_assets" TO "service_role";

GRANT REFERENCES ON TABLE "public"."equipment_assets" TO "service_role";

GRANT TRIGGER ON TABLE "public"."equipment_assets" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."equipment_assets" TO "service_role";

GRANT INSERT ON TABLE "public"."equipment_assets" TO "authenticated";

GRANT SELECT ON TABLE "public"."equipment_assets" TO "authenticated";

GRANT UPDATE ON TABLE "public"."equipment_assets" TO "authenticated";

GRANT DELETE ON TABLE "public"."equipment_assets" TO "authenticated";

REVOKE ALL ON TABLE "public"."equipment_maintenance_logs" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT SELECT ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT UPDATE ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT DELETE ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT REFERENCES ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT TRIGGER ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."equipment_maintenance_logs" TO "postgres";

GRANT INSERT ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT SELECT ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT UPDATE ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT DELETE ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT REFERENCES ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT TRIGGER ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."equipment_maintenance_logs" TO "service_role";

GRANT INSERT ON TABLE "public"."equipment_maintenance_logs" TO "authenticated";

GRANT SELECT ON TABLE "public"."equipment_maintenance_logs" TO "authenticated";

GRANT UPDATE ON TABLE "public"."equipment_maintenance_logs" TO "authenticated";

GRANT DELETE ON TABLE "public"."equipment_maintenance_logs" TO "authenticated";

REVOKE ALL ON TABLE "public"."fama_control_admins" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT SELECT ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT UPDATE ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT DELETE ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fama_control_admins" TO "postgres";

GRANT INSERT ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT UPDATE ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT DELETE ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT REFERENCES ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT TRIGGER ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."fama_control_admins" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_control_admins" TO "authenticated";

REVOKE ALL ON TABLE "public"."fama_control_backups" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT SELECT ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT UPDATE ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT DELETE ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fama_control_backups" TO "postgres";

GRANT INSERT ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT UPDATE ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT DELETE ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT REFERENCES ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT TRIGGER ON TABLE "public"."fama_control_backups" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."fama_control_backups" TO "service_role";

REVOKE ALL ON TABLE "public"."fama_quote_config" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT SELECT ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT UPDATE ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT DELETE ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fama_quote_config" TO "postgres";

GRANT INSERT ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT UPDATE ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT DELETE ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT REFERENCES ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT TRIGGER ON TABLE "public"."fama_quote_config" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."fama_quote_config" TO "service_role";

REVOKE ALL ON TABLE "public"."fama_settings" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."fama_settings" TO "postgres";

GRANT SELECT ON TABLE "public"."fama_settings" TO "postgres";

GRANT UPDATE ON TABLE "public"."fama_settings" TO "postgres";

GRANT DELETE ON TABLE "public"."fama_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fama_settings" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fama_settings" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fama_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fama_settings" TO "postgres";

GRANT INSERT ON TABLE "public"."fama_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_settings" TO "service_role";

GRANT UPDATE ON TABLE "public"."fama_settings" TO "service_role";

GRANT DELETE ON TABLE "public"."fama_settings" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."fama_settings" TO "service_role";

GRANT REFERENCES ON TABLE "public"."fama_settings" TO "service_role";

GRANT TRIGGER ON TABLE "public"."fama_settings" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."fama_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."fama_settings" TO "authenticated";

REVOKE ALL ON TABLE "public"."followups" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."followups" TO "postgres";

GRANT SELECT ON TABLE "public"."followups" TO "postgres";

GRANT UPDATE ON TABLE "public"."followups" TO "postgres";

GRANT DELETE ON TABLE "public"."followups" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."followups" TO "postgres";

GRANT REFERENCES ON TABLE "public"."followups" TO "postgres";

GRANT TRIGGER ON TABLE "public"."followups" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."followups" TO "postgres";

GRANT INSERT ON TABLE "public"."followups" TO "service_role";

GRANT SELECT ON TABLE "public"."followups" TO "service_role";

GRANT UPDATE ON TABLE "public"."followups" TO "service_role";

GRANT DELETE ON TABLE "public"."followups" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."followups" TO "service_role";

GRANT REFERENCES ON TABLE "public"."followups" TO "service_role";

GRANT TRIGGER ON TABLE "public"."followups" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."followups" TO "service_role";

GRANT INSERT ON TABLE "public"."followups" TO "authenticated";

GRANT SELECT ON TABLE "public"."followups" TO "authenticated";

GRANT UPDATE ON TABLE "public"."followups" TO "authenticated";

GRANT DELETE ON TABLE "public"."followups" TO "authenticated";

REVOKE ALL ON TABLE "public"."inventory_items" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."inventory_items" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_items" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_items" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_items" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_items" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_items" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_items" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_items" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_items" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_items" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_items" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_items" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."inventory_movements" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."inventory_movements" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_movements" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_movements" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_movements" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_movements" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_movements" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_movements" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_movements" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_movements" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_movements" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_movements" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_movements" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_movements" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_movements" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_movements" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_movements" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_movements" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_movements" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_movements" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_movements" TO "authenticated";

REVOKE ALL ON TABLE "public"."leads" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."leads" TO "postgres";

GRANT SELECT ON TABLE "public"."leads" TO "postgres";

GRANT UPDATE ON TABLE "public"."leads" TO "postgres";

GRANT DELETE ON TABLE "public"."leads" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."leads" TO "postgres";

GRANT REFERENCES ON TABLE "public"."leads" TO "postgres";

GRANT TRIGGER ON TABLE "public"."leads" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."leads" TO "postgres";

GRANT INSERT ON TABLE "public"."leads" TO "service_role";

GRANT SELECT ON TABLE "public"."leads" TO "service_role";

GRANT UPDATE ON TABLE "public"."leads" TO "service_role";

GRANT DELETE ON TABLE "public"."leads" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."leads" TO "service_role";

GRANT REFERENCES ON TABLE "public"."leads" TO "service_role";

GRANT TRIGGER ON TABLE "public"."leads" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."leads" TO "service_role";

GRANT INSERT ON TABLE "public"."leads" TO "authenticated";

GRANT SELECT ON TABLE "public"."leads" TO "authenticated";

GRANT UPDATE ON TABLE "public"."leads" TO "authenticated";

GRANT DELETE ON TABLE "public"."leads" TO "authenticated";

REVOKE ALL ON TABLE "public"."legal_consents" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."legal_consents" TO "postgres";

GRANT SELECT ON TABLE "public"."legal_consents" TO "postgres";

GRANT UPDATE ON TABLE "public"."legal_consents" TO "postgres";

GRANT DELETE ON TABLE "public"."legal_consents" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."legal_consents" TO "postgres";

GRANT REFERENCES ON TABLE "public"."legal_consents" TO "postgres";

GRANT TRIGGER ON TABLE "public"."legal_consents" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."legal_consents" TO "postgres";

GRANT INSERT ON TABLE "public"."legal_consents" TO "service_role";

GRANT SELECT ON TABLE "public"."legal_consents" TO "service_role";

GRANT UPDATE ON TABLE "public"."legal_consents" TO "service_role";

GRANT DELETE ON TABLE "public"."legal_consents" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."legal_consents" TO "service_role";

GRANT REFERENCES ON TABLE "public"."legal_consents" TO "service_role";

GRANT TRIGGER ON TABLE "public"."legal_consents" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."legal_consents" TO "service_role";

GRANT INSERT ON TABLE "public"."legal_consents" TO "authenticated";

GRANT SELECT ON TABLE "public"."legal_consents" TO "authenticated";

GRANT UPDATE ON TABLE "public"."legal_consents" TO "authenticated";

GRANT DELETE ON TABLE "public"."legal_consents" TO "authenticated";

REVOKE ALL ON TABLE "public"."maintenance_plans" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT SELECT ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT UPDATE ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT DELETE ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT REFERENCES ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT TRIGGER ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."maintenance_plans" TO "postgres";

GRANT INSERT ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT SELECT ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT UPDATE ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT DELETE ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT REFERENCES ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT TRIGGER ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."maintenance_plans" TO "service_role";

GRANT INSERT ON TABLE "public"."maintenance_plans" TO "authenticated";

GRANT SELECT ON TABLE "public"."maintenance_plans" TO "authenticated";

GRANT UPDATE ON TABLE "public"."maintenance_plans" TO "authenticated";

GRANT DELETE ON TABLE "public"."maintenance_plans" TO "authenticated";

REVOKE ALL ON TABLE "public"."organization_members" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."organization_members" TO "postgres";

GRANT SELECT ON TABLE "public"."organization_members" TO "postgres";

GRANT UPDATE ON TABLE "public"."organization_members" TO "postgres";

GRANT DELETE ON TABLE "public"."organization_members" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."organization_members" TO "postgres";

GRANT REFERENCES ON TABLE "public"."organization_members" TO "postgres";

GRANT TRIGGER ON TABLE "public"."organization_members" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."organization_members" TO "postgres";

GRANT INSERT ON TABLE "public"."organization_members" TO "service_role";

GRANT SELECT ON TABLE "public"."organization_members" TO "service_role";

GRANT UPDATE ON TABLE "public"."organization_members" TO "service_role";

GRANT DELETE ON TABLE "public"."organization_members" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."organization_members" TO "service_role";

GRANT REFERENCES ON TABLE "public"."organization_members" TO "service_role";

GRANT TRIGGER ON TABLE "public"."organization_members" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."organization_members" TO "service_role";

GRANT INSERT ON TABLE "public"."organization_members" TO "authenticated";

GRANT SELECT ON TABLE "public"."organization_members" TO "authenticated";

GRANT UPDATE ON TABLE "public"."organization_members" TO "authenticated";

GRANT DELETE ON TABLE "public"."organization_members" TO "authenticated";

REVOKE ALL ON TABLE "public"."organizations" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."organizations" TO "postgres";

GRANT SELECT ON TABLE "public"."organizations" TO "postgres";

GRANT UPDATE ON TABLE "public"."organizations" TO "postgres";

GRANT DELETE ON TABLE "public"."organizations" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."organizations" TO "postgres";

GRANT REFERENCES ON TABLE "public"."organizations" TO "postgres";

GRANT TRIGGER ON TABLE "public"."organizations" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."organizations" TO "postgres";

GRANT INSERT ON TABLE "public"."organizations" TO "service_role";

GRANT SELECT ON TABLE "public"."organizations" TO "service_role";

GRANT UPDATE ON TABLE "public"."organizations" TO "service_role";

GRANT DELETE ON TABLE "public"."organizations" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."organizations" TO "service_role";

GRANT REFERENCES ON TABLE "public"."organizations" TO "service_role";

GRANT TRIGGER ON TABLE "public"."organizations" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."organizations" TO "service_role";

GRANT INSERT ON TABLE "public"."organizations" TO "authenticated";

GRANT SELECT ON TABLE "public"."organizations" TO "authenticated";

GRANT UPDATE ON TABLE "public"."organizations" TO "authenticated";

GRANT DELETE ON TABLE "public"."organizations" TO "authenticated";

REVOKE ALL ON TABLE "public"."platform_settings" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."platform_settings" TO "postgres";

GRANT SELECT ON TABLE "public"."platform_settings" TO "postgres";

GRANT UPDATE ON TABLE "public"."platform_settings" TO "postgres";

GRANT DELETE ON TABLE "public"."platform_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."platform_settings" TO "postgres";

GRANT REFERENCES ON TABLE "public"."platform_settings" TO "postgres";

GRANT TRIGGER ON TABLE "public"."platform_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."platform_settings" TO "postgres";

GRANT INSERT ON TABLE "public"."platform_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."platform_settings" TO "service_role";

GRANT UPDATE ON TABLE "public"."platform_settings" TO "service_role";

GRANT DELETE ON TABLE "public"."platform_settings" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."platform_settings" TO "service_role";

GRANT REFERENCES ON TABLE "public"."platform_settings" TO "service_role";

GRANT TRIGGER ON TABLE "public"."platform_settings" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."platform_settings" TO "service_role";

REVOKE ALL ON TABLE "public"."pool_issue_history" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT SELECT ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT UPDATE ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT DELETE ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT REFERENCES ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT TRIGGER ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."pool_issue_history" TO "postgres";

GRANT INSERT ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT SELECT ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT UPDATE ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT DELETE ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT REFERENCES ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT TRIGGER ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."pool_issue_history" TO "service_role";

GRANT INSERT ON TABLE "public"."pool_issue_history" TO "authenticated";

GRANT SELECT ON TABLE "public"."pool_issue_history" TO "authenticated";

GRANT UPDATE ON TABLE "public"."pool_issue_history" TO "authenticated";

GRANT DELETE ON TABLE "public"."pool_issue_history" TO "authenticated";

REVOKE ALL ON TABLE "public"."pool_quote_calculations" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT SELECT ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT UPDATE ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT DELETE ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT REFERENCES ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT TRIGGER ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."pool_quote_calculations" TO "postgres";

GRANT INSERT ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT SELECT ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT UPDATE ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT DELETE ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT TRUNCATE ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT REFERENCES ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT TRIGGER ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT MAINTAIN ON TABLE "public"."pool_quote_calculations" TO "anon";

GRANT INSERT ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT SELECT ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT UPDATE ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT DELETE ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."pool_quote_calculations" TO "authenticated";

GRANT INSERT ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT SELECT ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT UPDATE ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT DELETE ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT REFERENCES ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT TRIGGER ON TABLE "public"."pool_quote_calculations" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."pool_quote_calculations" TO "service_role";

REVOKE ALL ON TABLE "public"."pool_quote_catalog_items" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT SELECT ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT UPDATE ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT DELETE ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT REFERENCES ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT TRIGGER ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."pool_quote_catalog_items" TO "postgres";

GRANT INSERT ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT SELECT ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT UPDATE ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT DELETE ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT TRUNCATE ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT REFERENCES ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT TRIGGER ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT MAINTAIN ON TABLE "public"."pool_quote_catalog_items" TO "anon";

GRANT INSERT ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."pool_quote_catalog_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT SELECT ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT DELETE ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."pool_quote_catalog_items" TO "service_role";

REVOKE ALL ON TABLE "public"."pool_quote_templates" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT SELECT ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT UPDATE ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT DELETE ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT REFERENCES ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT TRIGGER ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."pool_quote_templates" TO "postgres";

GRANT INSERT ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT SELECT ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT UPDATE ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT DELETE ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT TRUNCATE ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT REFERENCES ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT TRIGGER ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT MAINTAIN ON TABLE "public"."pool_quote_templates" TO "anon";

GRANT INSERT ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT SELECT ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT UPDATE ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT DELETE ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."pool_quote_templates" TO "authenticated";

GRANT INSERT ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT SELECT ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT UPDATE ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT DELETE ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT TRIGGER ON TABLE "public"."pool_quote_templates" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."pool_quote_templates" TO "service_role";

REVOKE ALL ON TABLE "public"."privacy_requests" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."privacy_requests" TO "postgres";

GRANT SELECT ON TABLE "public"."privacy_requests" TO "postgres";

GRANT UPDATE ON TABLE "public"."privacy_requests" TO "postgres";

GRANT DELETE ON TABLE "public"."privacy_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."privacy_requests" TO "postgres";

GRANT REFERENCES ON TABLE "public"."privacy_requests" TO "postgres";

GRANT TRIGGER ON TABLE "public"."privacy_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."privacy_requests" TO "postgres";

GRANT INSERT ON TABLE "public"."privacy_requests" TO "service_role";

GRANT SELECT ON TABLE "public"."privacy_requests" TO "service_role";

GRANT UPDATE ON TABLE "public"."privacy_requests" TO "service_role";

GRANT DELETE ON TABLE "public"."privacy_requests" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."privacy_requests" TO "service_role";

GRANT REFERENCES ON TABLE "public"."privacy_requests" TO "service_role";

GRANT TRIGGER ON TABLE "public"."privacy_requests" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."privacy_requests" TO "service_role";

GRANT INSERT ON TABLE "public"."privacy_requests" TO "authenticated";

GRANT SELECT ON TABLE "public"."privacy_requests" TO "authenticated";

GRANT UPDATE ON TABLE "public"."privacy_requests" TO "authenticated";

GRANT DELETE ON TABLE "public"."privacy_requests" TO "authenticated";

REVOKE ALL ON TABLE "public"."protected_records" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."protected_records" TO "postgres";

GRANT SELECT ON TABLE "public"."protected_records" TO "postgres";

GRANT UPDATE ON TABLE "public"."protected_records" TO "postgres";

GRANT DELETE ON TABLE "public"."protected_records" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."protected_records" TO "postgres";

GRANT REFERENCES ON TABLE "public"."protected_records" TO "postgres";

GRANT TRIGGER ON TABLE "public"."protected_records" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."protected_records" TO "postgres";

GRANT INSERT ON TABLE "public"."protected_records" TO "service_role";

GRANT SELECT ON TABLE "public"."protected_records" TO "service_role";

GRANT UPDATE ON TABLE "public"."protected_records" TO "service_role";

GRANT DELETE ON TABLE "public"."protected_records" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."protected_records" TO "service_role";

GRANT REFERENCES ON TABLE "public"."protected_records" TO "service_role";

GRANT TRIGGER ON TABLE "public"."protected_records" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."protected_records" TO "service_role";

REVOKE ALL ON TABLE "public"."purchases" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."purchases" TO "postgres";

GRANT SELECT ON TABLE "public"."purchases" TO "postgres";

GRANT UPDATE ON TABLE "public"."purchases" TO "postgres";

GRANT DELETE ON TABLE "public"."purchases" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."purchases" TO "postgres";

GRANT REFERENCES ON TABLE "public"."purchases" TO "postgres";

GRANT TRIGGER ON TABLE "public"."purchases" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."purchases" TO "postgres";

GRANT INSERT ON TABLE "public"."purchases" TO "service_role";

GRANT SELECT ON TABLE "public"."purchases" TO "service_role";

GRANT UPDATE ON TABLE "public"."purchases" TO "service_role";

GRANT DELETE ON TABLE "public"."purchases" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."purchases" TO "service_role";

GRANT REFERENCES ON TABLE "public"."purchases" TO "service_role";

GRANT TRIGGER ON TABLE "public"."purchases" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."purchases" TO "service_role";

REVOKE ALL ON TABLE "public"."quotes" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."quotes" TO "postgres";

GRANT SELECT ON TABLE "public"."quotes" TO "postgres";

GRANT UPDATE ON TABLE "public"."quotes" TO "postgres";

GRANT DELETE ON TABLE "public"."quotes" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."quotes" TO "postgres";

GRANT REFERENCES ON TABLE "public"."quotes" TO "postgres";

GRANT TRIGGER ON TABLE "public"."quotes" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."quotes" TO "postgres";

GRANT INSERT ON TABLE "public"."quotes" TO "service_role";

GRANT SELECT ON TABLE "public"."quotes" TO "service_role";

GRANT UPDATE ON TABLE "public"."quotes" TO "service_role";

GRANT DELETE ON TABLE "public"."quotes" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."quotes" TO "service_role";

GRANT REFERENCES ON TABLE "public"."quotes" TO "service_role";

GRANT TRIGGER ON TABLE "public"."quotes" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."quotes" TO "service_role";

GRANT INSERT ON TABLE "public"."quotes" TO "authenticated";

GRANT SELECT ON TABLE "public"."quotes" TO "authenticated";

GRANT UPDATE ON TABLE "public"."quotes" TO "authenticated";

GRANT DELETE ON TABLE "public"."quotes" TO "authenticated";

REVOKE ALL ON TABLE "public"."recovery_snapshots" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT SELECT ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT UPDATE ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT DELETE ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT REFERENCES ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT TRIGGER ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."recovery_snapshots" TO "postgres";

GRANT INSERT ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT SELECT ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT UPDATE ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT DELETE ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT REFERENCES ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT TRIGGER ON TABLE "public"."recovery_snapshots" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."recovery_snapshots" TO "service_role";

REVOKE ALL ON TABLE "public"."referrals" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."referrals" TO "postgres";

GRANT SELECT ON TABLE "public"."referrals" TO "postgres";

GRANT UPDATE ON TABLE "public"."referrals" TO "postgres";

GRANT DELETE ON TABLE "public"."referrals" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."referrals" TO "postgres";

GRANT REFERENCES ON TABLE "public"."referrals" TO "postgres";

GRANT TRIGGER ON TABLE "public"."referrals" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."referrals" TO "postgres";

GRANT INSERT ON TABLE "public"."referrals" TO "service_role";

GRANT SELECT ON TABLE "public"."referrals" TO "service_role";

GRANT UPDATE ON TABLE "public"."referrals" TO "service_role";

GRANT DELETE ON TABLE "public"."referrals" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."referrals" TO "service_role";

GRANT REFERENCES ON TABLE "public"."referrals" TO "service_role";

GRANT TRIGGER ON TABLE "public"."referrals" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."referrals" TO "service_role";

GRANT INSERT ON TABLE "public"."referrals" TO "authenticated";

GRANT SELECT ON TABLE "public"."referrals" TO "authenticated";

GRANT UPDATE ON TABLE "public"."referrals" TO "authenticated";

GRANT DELETE ON TABLE "public"."referrals" TO "authenticated";

REVOKE ALL ON TABLE "public"."request_rate_limits" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT SELECT ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT UPDATE ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT DELETE ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT REFERENCES ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT TRIGGER ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."request_rate_limits" TO "postgres";

GRANT INSERT ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT SELECT ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT UPDATE ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT DELETE ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT REFERENCES ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT TRIGGER ON TABLE "public"."request_rate_limits" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."request_rate_limits" TO "service_role";

REVOKE ALL ON TABLE "public"."service_price_catalog" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT SELECT ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT UPDATE ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT DELETE ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT REFERENCES ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT TRIGGER ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."service_price_catalog" TO "postgres";

GRANT INSERT ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT SELECT ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT UPDATE ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT DELETE ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT REFERENCES ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT TRIGGER ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."service_price_catalog" TO "service_role";

GRANT INSERT ON TABLE "public"."service_price_catalog" TO "authenticated";

GRANT SELECT ON TABLE "public"."service_price_catalog" TO "authenticated";

GRANT UPDATE ON TABLE "public"."service_price_catalog" TO "authenticated";

GRANT DELETE ON TABLE "public"."service_price_catalog" TO "authenticated";

REVOKE ALL ON TABLE "public"."service_reports" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."service_reports" TO "postgres";

GRANT SELECT ON TABLE "public"."service_reports" TO "postgres";

GRANT UPDATE ON TABLE "public"."service_reports" TO "postgres";

GRANT DELETE ON TABLE "public"."service_reports" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."service_reports" TO "postgres";

GRANT REFERENCES ON TABLE "public"."service_reports" TO "postgres";

GRANT TRIGGER ON TABLE "public"."service_reports" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."service_reports" TO "postgres";

GRANT INSERT ON TABLE "public"."service_reports" TO "service_role";

GRANT SELECT ON TABLE "public"."service_reports" TO "service_role";

GRANT UPDATE ON TABLE "public"."service_reports" TO "service_role";

GRANT DELETE ON TABLE "public"."service_reports" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."service_reports" TO "service_role";

GRANT REFERENCES ON TABLE "public"."service_reports" TO "service_role";

GRANT TRIGGER ON TABLE "public"."service_reports" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."service_reports" TO "service_role";

GRANT INSERT ON TABLE "public"."service_reports" TO "authenticated";

GRANT SELECT ON TABLE "public"."service_reports" TO "authenticated";

GRANT UPDATE ON TABLE "public"."service_reports" TO "authenticated";

GRANT DELETE ON TABLE "public"."service_reports" TO "authenticated";

REVOKE ALL ON TABLE "public"."suppliers" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."suppliers" TO "postgres";

GRANT SELECT ON TABLE "public"."suppliers" TO "postgres";

GRANT UPDATE ON TABLE "public"."suppliers" TO "postgres";

GRANT DELETE ON TABLE "public"."suppliers" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."suppliers" TO "postgres";

GRANT REFERENCES ON TABLE "public"."suppliers" TO "postgres";

GRANT TRIGGER ON TABLE "public"."suppliers" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."suppliers" TO "postgres";

GRANT INSERT ON TABLE "public"."suppliers" TO "service_role";

GRANT SELECT ON TABLE "public"."suppliers" TO "service_role";

GRANT UPDATE ON TABLE "public"."suppliers" TO "service_role";

GRANT DELETE ON TABLE "public"."suppliers" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."suppliers" TO "service_role";

GRANT REFERENCES ON TABLE "public"."suppliers" TO "service_role";

GRANT TRIGGER ON TABLE "public"."suppliers" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."suppliers" TO "service_role";

REVOKE ALL ON TABLE "public"."support_tickets" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."support_tickets" TO "postgres";

GRANT SELECT ON TABLE "public"."support_tickets" TO "postgres";

GRANT UPDATE ON TABLE "public"."support_tickets" TO "postgres";

GRANT DELETE ON TABLE "public"."support_tickets" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."support_tickets" TO "postgres";

GRANT REFERENCES ON TABLE "public"."support_tickets" TO "postgres";

GRANT TRIGGER ON TABLE "public"."support_tickets" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."support_tickets" TO "postgres";

GRANT INSERT ON TABLE "public"."support_tickets" TO "service_role";

GRANT SELECT ON TABLE "public"."support_tickets" TO "service_role";

GRANT UPDATE ON TABLE "public"."support_tickets" TO "service_role";

GRANT DELETE ON TABLE "public"."support_tickets" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."support_tickets" TO "service_role";

GRANT REFERENCES ON TABLE "public"."support_tickets" TO "service_role";

GRANT TRIGGER ON TABLE "public"."support_tickets" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."support_tickets" TO "service_role";

REVOKE ALL ON TABLE "public"."transactions" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."transactions" TO "postgres";

GRANT SELECT ON TABLE "public"."transactions" TO "postgres";

GRANT UPDATE ON TABLE "public"."transactions" TO "postgres";

GRANT DELETE ON TABLE "public"."transactions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."transactions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."transactions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."transactions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."transactions" TO "postgres";

GRANT INSERT ON TABLE "public"."transactions" TO "service_role";

GRANT SELECT ON TABLE "public"."transactions" TO "service_role";

GRANT UPDATE ON TABLE "public"."transactions" TO "service_role";

GRANT DELETE ON TABLE "public"."transactions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."transactions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."transactions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."transactions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."transactions" TO "service_role";

GRANT INSERT ON TABLE "public"."transactions" TO "authenticated";

GRANT SELECT ON TABLE "public"."transactions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."transactions" TO "authenticated";

GRANT DELETE ON TABLE "public"."transactions" TO "authenticated";

REVOKE ALL ON TABLE "public"."warranties" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."warranties" TO "postgres";

GRANT SELECT ON TABLE "public"."warranties" TO "postgres";

GRANT UPDATE ON TABLE "public"."warranties" TO "postgres";

GRANT DELETE ON TABLE "public"."warranties" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."warranties" TO "postgres";

GRANT REFERENCES ON TABLE "public"."warranties" TO "postgres";

GRANT TRIGGER ON TABLE "public"."warranties" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."warranties" TO "postgres";

GRANT INSERT ON TABLE "public"."warranties" TO "service_role";

GRANT SELECT ON TABLE "public"."warranties" TO "service_role";

GRANT UPDATE ON TABLE "public"."warranties" TO "service_role";

GRANT DELETE ON TABLE "public"."warranties" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."warranties" TO "service_role";

GRANT REFERENCES ON TABLE "public"."warranties" TO "service_role";

GRANT TRIGGER ON TABLE "public"."warranties" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."warranties" TO "service_role";

GRANT INSERT ON TABLE "public"."warranties" TO "authenticated";

GRANT SELECT ON TABLE "public"."warranties" TO "authenticated";

GRANT UPDATE ON TABLE "public"."warranties" TO "authenticated";

GRANT DELETE ON TABLE "public"."warranties" TO "authenticated";

REVOKE ALL ON TABLE "public"."water_tests" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."water_tests" TO "postgres";

GRANT SELECT ON TABLE "public"."water_tests" TO "postgres";

GRANT UPDATE ON TABLE "public"."water_tests" TO "postgres";

GRANT DELETE ON TABLE "public"."water_tests" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."water_tests" TO "postgres";

GRANT REFERENCES ON TABLE "public"."water_tests" TO "postgres";

GRANT TRIGGER ON TABLE "public"."water_tests" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."water_tests" TO "postgres";

GRANT INSERT ON TABLE "public"."water_tests" TO "service_role";

GRANT SELECT ON TABLE "public"."water_tests" TO "service_role";

GRANT UPDATE ON TABLE "public"."water_tests" TO "service_role";

GRANT DELETE ON TABLE "public"."water_tests" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."water_tests" TO "service_role";

GRANT REFERENCES ON TABLE "public"."water_tests" TO "service_role";

GRANT TRIGGER ON TABLE "public"."water_tests" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."water_tests" TO "service_role";

GRANT INSERT ON TABLE "public"."water_tests" TO "authenticated";

GRANT SELECT ON TABLE "public"."water_tests" TO "authenticated";

GRANT UPDATE ON TABLE "public"."water_tests" TO "authenticated";

GRANT DELETE ON TABLE "public"."water_tests" TO "authenticated";

REVOKE ALL ON TABLE "public"."work_order_items" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."work_order_items" TO "postgres";

GRANT SELECT ON TABLE "public"."work_order_items" TO "postgres";

GRANT UPDATE ON TABLE "public"."work_order_items" TO "postgres";

GRANT DELETE ON TABLE "public"."work_order_items" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."work_order_items" TO "postgres";

GRANT REFERENCES ON TABLE "public"."work_order_items" TO "postgres";

GRANT TRIGGER ON TABLE "public"."work_order_items" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."work_order_items" TO "postgres";

GRANT INSERT ON TABLE "public"."work_order_items" TO "service_role";

GRANT SELECT ON TABLE "public"."work_order_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."work_order_items" TO "service_role";

GRANT DELETE ON TABLE "public"."work_order_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."work_order_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."work_order_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."work_order_items" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."work_order_items" TO "service_role";

GRANT INSERT ON TABLE "public"."work_order_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."work_order_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."work_order_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."work_order_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."work_orders" FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT ON TABLE "public"."work_orders" TO "postgres";

GRANT SELECT ON TABLE "public"."work_orders" TO "postgres";

GRANT UPDATE ON TABLE "public"."work_orders" TO "postgres";

GRANT DELETE ON TABLE "public"."work_orders" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."work_orders" TO "postgres";

GRANT REFERENCES ON TABLE "public"."work_orders" TO "postgres";

GRANT TRIGGER ON TABLE "public"."work_orders" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."work_orders" TO "postgres";

GRANT INSERT ON TABLE "public"."work_orders" TO "service_role";

GRANT SELECT ON TABLE "public"."work_orders" TO "service_role";

GRANT UPDATE ON TABLE "public"."work_orders" TO "service_role";

GRANT DELETE ON TABLE "public"."work_orders" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."work_orders" TO "service_role";

GRANT REFERENCES ON TABLE "public"."work_orders" TO "service_role";

GRANT TRIGGER ON TABLE "public"."work_orders" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."work_orders" TO "service_role";

GRANT INSERT ON TABLE "public"."work_orders" TO "authenticated";

GRANT SELECT ON TABLE "public"."work_orders" TO "authenticated";

GRANT UPDATE ON TABLE "public"."work_orders" TO "authenticated";

GRANT DELETE ON TABLE "public"."work_orders" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."audit_logs_id_seq" FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON SEQUENCE "public"."audit_logs_id_seq" TO "postgres";

GRANT UPDATE ON SEQUENCE "public"."audit_logs_id_seq" TO "postgres";

GRANT USAGE ON SEQUENCE "public"."audit_logs_id_seq" TO "postgres";

GRANT SELECT ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";

GRANT UPDATE ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";

GRANT USAGE ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";

GRANT SELECT ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";

GRANT UPDATE ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";

GRANT USAGE ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";

REVOKE ALL ON FUNCTION "private"."can_manage_team"(p_organization_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."can_manage_team"(p_organization_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."can_manage_team"(p_organization_id text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."can_manage_team"(p_organization_id text) TO "service_role";

REVOKE ALL ON FUNCTION "private"."current_user_email"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."current_user_email"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."current_user_email"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."current_user_email"() TO "service_role";

REVOKE ALL ON FUNCTION "private"."fama_apply_work_order_inventory"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_apply_work_order_inventory"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_audit_row_change"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_audit_row_change"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_control_daily_backup"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_control_daily_backup"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_enrich_backup_payload"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_enrich_backup_payload"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_generate_followups"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_generate_followups"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_pool_volume_liters"(p_shape text, p_length numeric, p_width numeric, p_diameter numeric, p_shallow_depth numeric, p_deep_depth numeric, p_custom_area numeric) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_pool_volume_liters"(p_shape text, p_length numeric, p_width numeric, p_diameter numeric, p_shallow_depth numeric, p_deep_depth numeric, p_custom_area numeric) TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_post_sale_followup"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_post_sale_followup"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_recurring_billing"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_recurring_billing"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_referral_commission"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_referral_commission"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_sales_commission"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_sales_commission"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_schedule_next_maintenance"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_schedule_next_maintenance"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_service_commission"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_service_commission"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."fama_update_visit_delays"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."fama_update_visit_delays"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."has_org_permission"(p_organization_id text, p_permission text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."has_org_permission"(p_organization_id text, p_permission text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."has_org_permission"(p_organization_id text, p_permission text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."has_org_permission"(p_organization_id text, p_permission text) TO "service_role";

REVOKE ALL ON FUNCTION "private"."is_org_member"(p_organization_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."is_org_member"(p_organization_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."is_org_member"(p_organization_id text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."is_org_member"(p_organization_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_admin_create_company"(p_id text, p_name text, p_name_key text, p_slug text, p_plan text, p_member_id text, p_user_id text, p_email text, p_display_name text, p_permissions jsonb, p_actor_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_admin_create_company"(p_id text, p_name text, p_name_key text, p_slug text, p_plan text, p_member_id text, p_user_id text, p_email text, p_display_name text, p_permissions jsonb, p_actor_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_admin_create_company"(p_id text, p_name text, p_name_key text, p_slug text, p_plan text, p_member_id text, p_user_id text, p_email text, p_display_name text, p_permissions jsonb, p_actor_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_audit_change"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_audit_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_audit_change"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_consume_rate_limit"(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_consume_rate_limit"(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_consume_rate_limit"(p_key_hash text, p_action text, p_limit integer, p_window_seconds integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_control_auth_directory"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_control_auth_directory"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_control_auth_directory"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_control_health"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_control_health"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_control_health"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_control_restore_backup"(p_backup_id text, p_actor_user_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_control_restore_backup"(p_backup_id text, p_actor_user_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_control_restore_backup"(p_backup_id text, p_actor_user_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_control_restore_snapshot"(p_snapshot_id text, p_actor_user_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_control_restore_snapshot"(p_snapshot_id text, p_actor_user_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_control_restore_snapshot"(p_snapshot_id text, p_actor_user_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_finalize_work_order"(p_organization_id text, p_work_order_id text, p_actor_user_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_finalize_work_order"(p_organization_id text, p_work_order_id text, p_actor_user_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_finalize_work_order"(p_organization_id text, p_work_order_id text, p_actor_user_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_jsonb_sha256"(p_payload jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_jsonb_sha256"(p_payload jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_jsonb_sha256"(p_payload jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_record_protection_guard"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_record_protection_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_record_protection_guard"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fama_system_dashboard"(p_organization_id text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."fama_system_dashboard"(p_organization_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fama_system_dashboard"(p_organization_id text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fama_system_dashboard"(p_organization_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."schedule_warranty"(p_organization_id text, p_warranty_id text, p_scheduled_at text, p_technician text, p_appointment_id text, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."schedule_warranty"(p_organization_id text, p_warranty_id text, p_scheduled_at text, p_technician text, p_appointment_id text, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."schedule_warranty"(p_organization_id text, p_warranty_id text, p_scheduled_at text, p_technician text, p_appointment_id text, p_now timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "service_role";

COMMIT;

NOTIFY pgrst, 'reload schema';
