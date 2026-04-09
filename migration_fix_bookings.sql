-- ================================================
-- Migration: Fix bookings table column names
-- Run this in Supabase SQL Editor
-- ================================================

-- Option A: If table doesn't exist at all → create it fresh
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE
);

-- Option B: If columns are named 'start'/'end' → rename them
DO $$
BEGIN
  -- rename 'start' → 'start_time' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'start'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN "start" TO start_time;
  END IF;

  -- rename 'end' → 'end_time' if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'end'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN "end" TO end_time;
  END IF;

  -- Add start_time if missing entirely
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN start_time TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add end_time if missing entirely
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN end_time TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add reminder_sent if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'reminder_sent'
  ) THEN
    ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Verify result
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings'
ORDER BY ordinal_position;
