CREATE TABLE `channel_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`added_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_members_channel_user_unique` ON `channel_members` (`channel_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `channel_members_user_idx` ON `channel_members` (`user_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `channel_members` (`channel_id`, `user_id`, `added_by`, `created_at`)
SELECT `id`, `created_by`, `created_by`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `channels`;
--> statement-breakpoint
INSERT OR IGNORE INTO `channel_members` (`channel_id`, `user_id`, `added_by`, `created_at`)
SELECT DISTINCT `channel_id`, `created_by`, `created_by`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `tasks`;
--> statement-breakpoint
INSERT OR IGNORE INTO `channel_members` (`channel_id`, `user_id`, `added_by`, `created_at`)
SELECT DISTINCT `channel_id`, `current_assignee`, `created_by`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `tasks` WHERE `current_assignee` IS NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `channel_members` (`channel_id`, `user_id`, `added_by`, `created_at`)
SELECT DISTINCT t.`channel_id`, ta.`assigned_to`, t.`created_by`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `task_assignments` ta INNER JOIN `tasks` t ON t.`id` = ta.`task_id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `channel_members` (`channel_id`, `user_id`, `added_by`, `created_at`)
SELECT DISTINCT t.`channel_id`, ta.`assigned_by`, t.`created_by`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `task_assignments` ta INNER JOIN `tasks` t ON t.`id` = ta.`task_id`;