CREATE TABLE `channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channels_created_at_idx` ON `channels` (`created_at`);
--> statement-breakpoint
INSERT INTO `channels` (`name`, `description`, `created_by`, `created_at`, `updated_at`)
SELECT 'General', 'Default project channel', `id`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `users`
ORDER BY `id`
LIMIT 1;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `channel_id` integer REFERENCES `channels`(`id`);
--> statement-breakpoint
UPDATE `tasks` SET `channel_id` = (SELECT `id` FROM `channels` ORDER BY `id` LIMIT 1) WHERE `channel_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `tasks_channel_idx` ON `tasks` (`channel_id`);
