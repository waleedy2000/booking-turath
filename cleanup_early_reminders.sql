-- ================================================
-- Cleanup: Remove pending early_reminder events
-- ================================================
-- This script safely updates any pending 'early_reminder' 
-- events to 'skipped'. It does not affect events that were 
-- already sent, failed, expired, or skipped.
--
-- The schema does not contain an updated_at or completed_at column,
-- so we only update the status.
--
-- A SELECT query is provided before the UPDATE to verify 
-- the number of affected rows.

-- 1. Check how many pending early_reminder events exist
SELECT count(*) as pending_early_reminders_to_skip
FROM booking_notification_events
WHERE stage = 'early_reminder' 
  AND status = 'pending';

-- 2. Update their status to 'skipped'
UPDATE booking_notification_events
SET status = 'skipped'
WHERE stage = 'early_reminder' 
  AND status = 'pending';

-- 3. Verify the update (should return 0)
SELECT count(*) as remaining_pending_early_reminders
FROM booking_notification_events
WHERE stage = 'early_reminder' 
  AND status = 'pending';
