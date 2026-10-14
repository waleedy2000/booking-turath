-- ================================================
-- Migration: Booking Activity Log
-- Run in Supabase SQL Editor when ready for production
-- ================================================

CREATE TABLE IF NOT EXISTS booking_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('rescheduled', 'cancelled')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'booking_owner')),
  old_date DATE,
  old_start_time TEXT,
  old_end_time TEXT,
  new_date DATE,
  new_start_time TEXT,
  new_end_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_activity_log_booking_id
ON booking_activity_log(booking_id);

ALTER TABLE booking_activity_log ENABLE ROW LEVEL SECURITY;

-- No public policies added. Server routes access via service role.
