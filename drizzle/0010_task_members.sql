CREATE TABLE `task_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`added_by` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_members_task_user_unique` ON `task_members` (`task_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `task_members_user_idx` ON `task_members` (`user_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT `id`, `created_by`, `created_by`, `created_at` FROM `tasks`;
--> statement-breakpoint
INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT `task_id`, `assigned_to`, `assigned_by`, `assigned_at` FROM `task_assignments`;
--> statement-breakpoint
INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT `task_id`, `assigned_by`, `assigned_by`, `assigned_at` FROM `task_assignments`;
--> statement-breakpoint
INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT `task_id`, `sender_id`, `sender_id`, `created_at` FROM `task_messages`;
--> statement-breakpoint
INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT m.`task_id`, m.`recipient_id`, m.`sender_id`, m.`created_at` FROM `task_messages` m WHERE m.`recipient_id` IS NOT NULL;
