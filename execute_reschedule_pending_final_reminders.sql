BEGIN;

-- A. Diagnostic SELECT before update
SELECT 
    e.id,
    b.date,
    b.start_time,
    e.scheduled_at AS old_scheduled_at,
    ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '60 minutes' AS new_scheduled_at,
    CASE 
        WHEN ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') <= NOW() THEN 'MEETING_STARTED'
        WHEN (((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '60 minutes') <= NOW() THEN 'MISSED_NEW_WINDOW'
        ELSE 'FUTURE_RESCHEDULE'
    END as classification
FROM booking_notification_events e
JOIN bookings b ON e.booking_id = b.id
WHERE e.stage = 'final_reminder' 
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled';

-- B. Execute UPDATE for FUTURE_RESCHEDULE
UPDATE booking_notification_events e
SET 
    scheduled_at = ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '60 minutes',
    expires_at = ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '10 minutes'
FROM bookings b
WHERE e.booking_id = b.id
  AND e.stage = 'final_reminder'
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled'
  AND (((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '60 minutes') > NOW();

-- C. Execute UPDATE for MISSED_NEW_WINDOW
UPDATE booking_notification_events e
SET 
    status = 'expired',
    error = 'final_reminder_missed_new_window_reschedule',
    expires_at = ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '10 minutes'
FROM bookings b
WHERE e.booking_id = b.id
  AND e.stage = 'final_reminder'
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled'
  AND (((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - INTERVAL '60 minutes') <= NOW()
  AND ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') > NOW();

-- D. Execute UPDATE for MEETING_STARTED
UPDATE booking_notification_events e
SET 
    status = 'expired',
    error = 'meeting_already_started_reschedule'
FROM bookings b
WHERE e.booking_id = b.id
  AND e.stage = 'final_reminder'
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled'
  AND ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') <= NOW();

-- E. Final Validation SELECT
SELECT 
    e.id, 
    e.status, 
    e.scheduled_at, 
    e.error,
    ((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') AS meeting_start,
    EXTRACT(EPOCH FROM (((b.date + b.start_time::time) AT TIME ZONE 'Asia/Kuwait') - e.scheduled_at))/60 AS diff_minutes
FROM booking_notification_events e
JOIN bookings b ON e.booking_id = b.id
WHERE e.stage = 'final_reminder' 
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled';

COMMIT;
