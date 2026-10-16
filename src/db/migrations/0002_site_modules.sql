CREATE TABLE `drawings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drawings_project_idx` ON `drawings` (`project_id`);--> statement-breakpoint
CREATE INDEX `drawings_client_idx` ON `drawings` (`client_id`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_project_idx` ON `equipment` (`project_id`);--> statement-breakpoint
CREATE INDEX `equipment_client_idx` ON `equipment` (`client_id`);--> statement-breakpoint
CREATE TABLE `equipment_losses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_losses_project_idx` ON `equipment_losses` (`project_id`);--> statement-breakpoint
CREATE INDEX `equipment_losses_client_idx` ON `equipment_losses` (`client_id`);--> statement-breakpoint
CREATE TABLE `equipment_rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_rentals_project_idx` ON `equipment_rentals` (`project_id`);--> statement-breakpoint
CREATE INDEX `equipment_rentals_client_idx` ON `equipment_rentals` (`client_id`);--> statement-breakpoint
CREATE TABLE `equipment_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_stock_project_idx` ON `equipment_stock` (`project_id`);--> statement-breakpoint
CREATE INDEX `equipment_stock_client_idx` ON `equipment_stock` (`client_id`);--> statement-breakpoint
CREATE TABLE `equipment_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `equipment_transfers_project_idx` ON `equipment_transfers` (`project_id`);--> statement-breakpoint
CREATE INDEX `equipment_transfers_client_idx` ON `equipment_transfers` (`client_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `milestones_project_idx` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE INDEX `milestones_client_idx` ON `milestones` (`client_id`);--> statement-breakpoint
CREATE TABLE `site_instructions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_instructions_project_idx` ON `site_instructions` (`project_id`);--> statement-breakpoint
CREATE INDEX `site_instructions_client_idx` ON `site_instructions` (`client_id`);--> statement-breakpoint
CREATE TABLE `snags` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snags_project_idx` ON `snags` (`project_id`);--> statement-breakpoint
CREATE INDEX `snags_client_idx` ON `snags` (`client_id`);--> statement-breakpoint
CREATE TABLE `stoppages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stoppages_project_idx` ON `stoppages` (`project_id`);--> statement-breakpoint
CREATE INDEX `stoppages_client_idx` ON `stoppages` (`client_id`);--> statement-breakpoint
-- Phones that already synced pull a fresh snapshot once, so the new site tables (milestones, stoppages,
-- site instructions, equipment, snags, drawings) arrive.
UPDATE `sync_state` SET `cursor` = NULL;
