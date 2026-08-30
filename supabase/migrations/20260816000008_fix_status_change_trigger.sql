-- Fix: log_complaint_status_change() inserted NEW.status directly as event_type.
-- For statuses like 'pending'/'in_progress' this violated complaint_timeline_event_type_check.
-- Map complaint status to a valid event_type (constraint values: created, ai_classified, verified, rejected, progress, resolved, citizen_comment).

CREATE OR REPLACE FUNCTION log_complaint_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO complaint_timeline (complaint_id, actor_id, event_type, note)
    VALUES (
      NEW.id,
      auth.uid(),
      CASE NEW.status
        WHEN 'pending' THEN 'ai_classified'
        WHEN 'verified' THEN 'verified'
        WHEN 'in_progress' THEN 'progress'
        WHEN 'resolved' THEN 'resolved'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'created'
      END,
      CASE WHEN NEW.status = 'rejected' THEN NEW.rejection_reason ELSE NULL END
    );
  END IF;
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  RETURN NEW;
END; $$;