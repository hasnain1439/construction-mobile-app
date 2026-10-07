CREATE TABLE `advances` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `advances_project_idx` ON `advances` (`project_id`);--> statement-breakpoint
CREATE INDEX `advances_client_idx` ON `advances` (`client_id`);--> statement-breakpoint
CREATE TABLE `attachments_queue` (
	`client_id` text PRIMARY KEY NOT NULL,
	`local_uri` text NOT NULL,
	`kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`server_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attendance_project_idx` ON `attendance` (`project_id`);--> statement-breakpoint
CREATE INDEX `attendance_client_idx` ON `attendance` (`client_id`);--> statement-breakpoint
CREATE TABLE `cash_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cash_accounts_project_idx` ON `cash_accounts` (`project_id`);--> statement-breakpoint
CREATE INDEX `cash_accounts_client_idx` ON `cash_accounts` (`client_id`);--> statement-breakpoint
CREATE TABLE `cash_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cash_entries_project_idx` ON `cash_entries` (`project_id`);--> statement-breakpoint
CREATE INDEX `cash_entries_client_idx` ON `cash_entries` (`client_id`);--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daily_logs_project_idx` ON `daily_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `daily_logs_client_idx` ON `daily_logs` (`client_id`);--> statement-breakpoint
CREATE TABLE `dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dispatches_project_idx` ON `dispatches` (`project_id`);--> statement-breakpoint
CREATE INDEX `dispatches_client_idx` ON `dispatches` (`client_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `holidays_project_idx` ON `holidays` (`project_id`);--> statement-breakpoint
CREATE INDEX `holidays_client_idx` ON `holidays` (`client_id`);--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_groups_project_idx` ON `material_groups` (`project_id`);--> statement-breakpoint
CREATE INDEX `material_groups_client_idx` ON `material_groups` (`client_id`);--> statement-breakpoint
CREATE TABLE `material_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_usage_project_idx` ON `material_usage` (`project_id`);--> statement-breakpoint
CREATE INDEX `material_usage_client_idx` ON `material_usage` (`client_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `materials_project_idx` ON `materials` (`project_id`);--> statement-breakpoint
CREATE INDEX `materials_client_idx` ON `materials` (`client_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_project_idx` ON `notifications` (`project_id`);--> statement-breakpoint
CREATE INDEX `notifications_client_idx` ON `notifications` (`client_id`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`client_id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`depends_on` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`server_id` text,
	`local_changes` text DEFAULT '[]' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`device_created_at` text NOT NULL,
	`created_at` integer NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_status_idx` ON `outbox` (`status`,`seq`);--> statement-breakpoint
CREATE TABLE `owner_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `owner_deliveries_project_idx` ON `owner_deliveries` (`project_id`);--> statement-breakpoint
CREATE INDEX `owner_deliveries_client_idx` ON `owner_deliveries` (`client_id`);--> statement-breakpoint
CREATE TABLE `project_workers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_workers_project_idx` ON `project_workers` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_workers_client_idx` ON `project_workers` (`client_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_project_idx` ON `projects` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_client_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchases_project_idx` ON `purchases` (`project_id`);--> statement-breakpoint
CREATE INDEX `purchases_client_idx` ON `purchases` (`client_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `settings_project_idx` ON `settings` (`project_id`);--> statement-breakpoint
CREATE INDEX `settings_client_idx` ON `settings` (`client_id`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `settlements_project_idx` ON `settlements` (`project_id`);--> statement-breakpoint
CREATE INDEX `settlements_client_idx` ON `settlements` (`client_id`);--> statement-breakpoint
CREATE TABLE `site_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_stock_project_idx` ON `site_stock` (`project_id`);--> statement-breakpoint
CREATE INDEX `site_stock_client_idx` ON `site_stock` (`client_id`);--> statement-breakpoint
CREATE TABLE `stock_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_counts_project_idx` ON `stock_counts` (`project_id`);--> statement-breakpoint
CREATE INDEX `stock_counts_client_idx` ON `stock_counts` (`client_id`);--> statement-breakpoint
CREATE TABLE `stock_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_locations_project_idx` ON `stock_locations` (`project_id`);--> statement-breakpoint
CREATE INDEX `stock_locations_client_idx` ON `stock_locations` (`client_id`);--> statement-breakpoint
CREATE TABLE `subcontract_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subcontract_assignments_project_idx` ON `subcontract_assignments` (`project_id`);--> statement-breakpoint
CREATE INDEX `subcontract_assignments_client_idx` ON `subcontract_assignments` (`client_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_project_idx` ON `suppliers` (`project_id`);--> statement-breakpoint
CREATE INDEX `suppliers_client_idx` ON `suppliers` (`client_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`cursor` text,
	`last_pull_at` integer,
	`last_push_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `topup_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `topup_requests_project_idx` ON `topup_requests` (`project_id`);--> statement-breakpoint
CREATE INDEX `topup_requests_client_idx` ON `topup_requests` (`client_id`);--> statement-breakpoint
CREATE TABLE `work_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `work_measurements_project_idx` ON `work_measurements` (`project_id`);--> statement-breakpoint
CREATE INDEX `work_measurements_client_idx` ON `work_measurements` (`client_id`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workers_project_idx` ON `workers` (`project_id`);--> statement-breakpoint
CREATE INDEX `workers_client_idx` ON `workers` (`client_id`);