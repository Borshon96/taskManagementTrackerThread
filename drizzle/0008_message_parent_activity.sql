ALTER TABLE `task_messages` ADD `parent_activity_id` integer REFERENCES `task_activities`(`id`);
--> statement-breakpoint
CREATE INDEX `task_messages_parent_activity_idx` ON `task_messages` (`parent_activity_id`);
