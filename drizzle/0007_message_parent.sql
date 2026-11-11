ALTER TABLE `task_messages` ADD `parent_message_id` integer REFERENCES `task_messages`(`id`);
--> statement-breakpoint
CREATE INDEX `task_messages_parent_idx` ON `task_messages` (`parent_message_id`);
