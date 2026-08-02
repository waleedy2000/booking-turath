-- ================================================
-- Migration: Allow Rebooking Cancelled Slots
-- Run this in Supabase SQL Editor
-- ================================================

-- Preflight Check (Read-only):
-- Run this query first to ensure there are no existing active duplicates
-- that would cause the new unique index creation to fail.
-- It should return NO rows.
/*
SELECT
  date,
  start_time,
  COUNT(*) AS active_count
FROM public.bookings
WHERE status IS DISTINCT FROM 'cancelled'
GROUP BY date, start_time
HAVING COUNT(*) > 1;
*/

-- ================================================
-- Migration Transaction
-- ================================================
-- Explanation:
-- 1. We drop the strict UNIQUE constraint which blindly prevents ANY two bookings
--    from having the same date and start_time, regardless of their status.
-- 2. We replace it with a partial UNIQUE index.
--    The condition "WHERE status IS DISTINCT FROM 'cancelled'" ensures that:
--    - 'cancelled' bookings are completely ignored by this unique index.
--    - NULL status is treated as an active booking (because NULL IS DISTINCT FROM 'cancelled' is TRUE).
--    - Any other status (e.g. 'active') is also treated as an active booking.
-- This allows us to keep cancelled bookings in the database for historical records
-- while freeing up their time slot for new bookings.
-- ================================================

BEGIN;

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS unique_booking_slot;

CREATE UNIQUE INDEX unique_active_booking_slot
ON public.bookings (date, start_time)
WHERE status IS DISTINCT FROM 'cancelled';

COMMIT;

-- ================================================
-- Post-flight Verification:
-- Run this query to confirm the changes.
-- Expected Result:
-- 1. unique_booking_slot should be gone.
-- 2. unique_active_booking_slot should exist.
-- 3. The indexdef for unique_active_booking_slot should contain:
--    WHERE (status IS DISTINCT FROM 'cancelled'::text)
-- ================================================
/*
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'bookings'
ORDER BY indexname;
*/
