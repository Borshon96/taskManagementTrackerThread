INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT t.`id`, cm.`user_id`, t.`created_by`, t.`created_at`
FROM `tasks` t
INNER JOIN `channel_members` cm ON cm.`channel_id` = t.`channel_id`;
