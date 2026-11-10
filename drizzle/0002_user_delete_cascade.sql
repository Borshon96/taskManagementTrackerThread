CREATE TABLE `internal_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `tasks_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `tasks_no_delete` BEFORE DELETE ON `tasks`
WHEN COALESCE((SELECT `value` FROM `internal_flags` WHERE `key` = 'allow_history_delete'), 0) = 0
BEGIN
  SELECT RAISE(ABORT, 'Tasks are permanent and cannot be deleted');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `task_assignments_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `task_assignments_no_delete` BEFORE DELETE ON `task_assignments`
WHEN COALESCE((SELECT `value` FROM `internal_flags` WHERE `key` = 'allow_history_delete'), 0) = 0
BEGIN
  SELECT RAISE(ABORT, 'Assignments are permanent and cannot be deleted');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `task_messages_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `task_messages_no_delete` BEFORE DELETE ON `task_messages`
WHEN COALESCE((SELECT `value` FROM `internal_flags` WHERE `key` = 'allow_history_delete'), 0) = 0
BEGIN
  SELECT RAISE(ABORT, 'Messages are immutable');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `task_activities_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `task_activities_no_delete` BEFORE DELETE ON `task_activities`
WHEN COALESCE((SELECT `value` FROM `internal_flags` WHERE `key` = 'allow_history_delete'), 0) = 0
BEGIN
  SELECT RAISE(ABORT, 'Activity records are immutable');
END;
