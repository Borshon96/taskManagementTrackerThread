ALTER TABLE `tasks` ADD `reopened_from_task_id` integer REFERENCES tasks(id);--> statement-breakpoint
CREATE INDEX `tasks_reopened_from_idx` ON `tasks` (`reopened_from_task_id`);