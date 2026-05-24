-- ================================================
-- Migration: Booking Notification Events
-- Run in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS booking_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'push')),
  stage TEXT NOT NULL CHECK (stage IN ('confirmation', 'early_reminder', 'final_reminder')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'expired', 'skipped')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, phone, channel, stage)
);

CREATE INDEX IF NOT EXISTS idx_booking_notification_events_status_scheduled
ON booking_notification_events(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_booking_notification_events_booking
ON booking_notification_events(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_notification_events_department
ON booking_notification_events(department_id);

CREATE INDEX IF NOT EXISTS idx_booking_notification_events_stage
ON booking_notification_events(stage);

ALTER TABLE booking_notification_events ENABLE ROW LEVEL SECURITY;

-- No public policies are added. Server-side processing uses the service role.
