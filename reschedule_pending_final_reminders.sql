-- ======================================================================
-- Script: Reschedule Pending Final Reminders (Corrected)
-- Purpose: Updates scheduled_at for pending final_reminder events to be 
--          exactly 60 minutes before the meeting starts, calculating from 
--          bookings.date and bookings.start_time.
--          Properly handles events that missed the new 60-minute window.
-- ======================================================================

-- 1. Review all pending final_reminders and classify them
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

-- 2. UPDATE: FUTURE_RESCHEDULE
-- Reschedule events that are still in the future based on the new 60-min window
/*
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
*/

-- 3. UPDATE: MISSED_NEW_WINDOW
-- Expire events where the 60-min reminder time has passed, but the meeting hasn't started
/*
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
*/

-- 4. UPDATE: MEETING_STARTED
-- Expire events where the meeting itself has already started
/*
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
*/

-- 5. Final check to ensure no final_reminder events are left pending on the old logic
SELECT e.id, e.status, e.scheduled_at, e.error
FROM booking_notification_events e
JOIN bookings b ON e.booking_id = b.id
WHERE e.stage = 'final_reminder' 
  AND e.status = 'pending'
  AND COALESCE(b.status, 'active') <> 'cancelled';
