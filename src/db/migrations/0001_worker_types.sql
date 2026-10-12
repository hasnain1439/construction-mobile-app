CREATE TABLE `worker_types` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`client_id` text,
	`local` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `worker_types_project_idx` ON `worker_types` (`project_id`);--> statement-breakpoint
CREATE INDEX `worker_types_client_idx` ON `worker_types` (`client_id`);--> statement-breakpoint
-- Phones that already synced pull a fresh snapshot once, so the company worker types arrive.
UPDATE `sync_state` SET `cursor` = NULL;