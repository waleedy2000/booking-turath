-- ================================================
-- Migration: Phone Identity Architecture
-- Run in Supabase SQL Editor
-- ================================================

-- 1. departments: add contact fields
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS booking_contact_name TEXT,
ADD COLUMN IF NOT EXISTS booking_contact_phone TEXT;

-- Copy existing phone data to booking_contact_phone
UPDATE departments
SET booking_contact_phone = phone
WHERE booking_contact_phone IS NULL AND phone IS NOT NULL;

-- 2. bookings: add department_id (nullable for backward compatibility)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Backfill department_id from department_name
UPDATE bookings b
SET department_id = d.id
FROM departments d
WHERE b.department_name = d.name
AND b.department_id IS NULL;

-- 3. department_participants table
CREATE TABLE IF NOT EXISTS department_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, phone)
);

-- 4. push_tokens: add phone-based lookup
ALTER TABLE push_tokens
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

-- Backfill phone from users table
UPDATE push_tokens pt
SET phone = u.phone
FROM users u
WHERE pt.user_id = u.id
AND pt.phone IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_tokens_phone ON push_tokens(phone);

-- 5. message_queue: add tracking fields (IF NOT EXISTS pattern)
ALTER TABLE message_queue
ADD COLUMN IF NOT EXISTS message_type TEXT,
ADD COLUMN IF NOT EXISTS department_id UUID,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

-- 6. RLS for department_participants (server-only via service role)
ALTER TABLE department_participants ENABLE ROW LEVEL SECURITY;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_participants_dept
ON department_participants(department_id, is_active);

-- ================================================
-- Verification
-- ================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('departments', 'bookings', 'push_tokens', 'message_queue', 'department_participants')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
