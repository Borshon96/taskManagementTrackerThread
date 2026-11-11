ALTER TABLE `task_messages` ADD `in_reply_to_message_id` integer REFERENCES `task_messages`(`id`);
--> statement-breakpoint
ALTER TABLE `task_messages` ADD `in_reply_to_activity_id` integer REFERENCES `task_activities`(`id`);
--> statement-breakpoint
CREATE INDEX `task_messages_in_reply_message_idx` ON `task_messages` (`in_reply_to_message_id`);
--> statement-breakpoint
CREATE INDEX `task_messages_in_reply_activity_idx` ON `task_messages` (`in_reply_to_activity_id`);
