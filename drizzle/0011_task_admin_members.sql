INSERT OR IGNORE INTO `task_members` (`task_id`, `user_id`, `added_by`, `created_at`)
SELECT t.`id`, u.`id`, t.`created_by`, t.`created_at`
FROM `tasks` t
CROSS JOIN `users` u
WHERE u.`role` = 'admin' AND u.`is_active` = 1;
