ALTER TABLE `notifications` ADD `activity_id` integer REFERENCES `task_activities`(`id`);
--> statement-breakpoint
ALTER TABLE `notifications` ADD `message_id` integer REFERENCES `task_messages`(`id`);
--> statement-breakpoint
CREATE INDEX `notifications_activity_idx` ON `notifications` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `notifications_message_idx` ON `notifications` (`message_id`);
