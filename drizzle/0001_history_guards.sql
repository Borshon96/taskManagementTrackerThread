INSERT INTO sqlite_sequence (name, seq) SELECT 'tasks', 1000 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'tasks');
--> statement-breakpoint
CREATE TRIGGER tasks_no_delete BEFORE DELETE ON tasks
BEGIN
  SELECT RAISE(ABORT, 'Tasks are permanent and cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER tasks_immutable_origin BEFORE UPDATE ON tasks
WHEN NEW.created_by IS NOT OLD.created_by
  OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at)
  OR (OLD.completed_by IS NOT NULL AND NEW.completed_by IS NOT OLD.completed_by)
BEGIN
  SELECT RAISE(ABORT, 'Task origin and completion fields cannot be rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER task_assignments_no_delete BEFORE DELETE ON task_assignments
BEGIN
  SELECT RAISE(ABORT, 'Assignments are permanent and cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER task_assignments_append_only BEFORE UPDATE ON task_assignments
WHEN NEW.task_id IS NOT OLD.task_id
  OR NEW.assigned_by IS NOT OLD.assigned_by
  OR NEW.assigned_to IS NOT OLD.assigned_to
  OR NEW.assignment_type IS NOT OLD.assignment_type
  OR NEW.instruction IS NOT OLD.instruction
  OR NEW.assigned_at IS NOT OLD.assigned_at
  OR (OLD.received_at IS NOT NULL AND NEW.received_at IS NOT OLD.received_at)
  OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at)
BEGIN
  SELECT RAISE(ABORT, 'Assignment history cannot be rewritten');
END;
--> statement-breakpoint
CREATE TRIGGER task_messages_no_update BEFORE UPDATE ON task_messages
BEGIN
  SELECT RAISE(ABORT, 'Messages are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER task_messages_no_delete BEFORE DELETE ON task_messages
BEGIN
  SELECT RAISE(ABORT, 'Messages are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER task_activities_no_update BEFORE UPDATE ON task_activities
BEGIN
  SELECT RAISE(ABORT, 'Activity records are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER task_activities_no_delete BEFORE DELETE ON task_activities
BEGIN
  SELECT RAISE(ABORT, 'Activity records are immutable');
END;
