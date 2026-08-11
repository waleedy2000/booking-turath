-- ================================================
-- Migration: Booking Invitees Table
-- Run in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS public.booking_invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL
    REFERENCES public.bookings(id)
    ON DELETE CASCADE,
  name TEXT,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, phone)
);

ALTER TABLE public.booking_invitees
ENABLE ROW LEVEL SECURITY;

-- ================================================
-- Post-flight Verification Queries
-- (Run manually in Supabase SQL Editor to verify)
-- ================================================
-- SELECT
--   c.relname,
--   c.relrowsecurity
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname = 'booking_invitees';
--
-- SELECT
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'booking_invitees';
