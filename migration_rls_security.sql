-- ================================================================
-- Migration: Enable RLS + Apply Security Policies
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================
-- After running, verify in: Authentication → Policies (or Table Editor)
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. PUSH_TOKENS
--    INSERT  → anon allowed   (client sends token via /api/save-token)
--    SELECT  → BLOCKED        (tokens are sensitive)
--    DELETE  → server only    (cleanup done server-side via service role)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anon INSERT (client saves its FCM token)
CREATE POLICY "Allow insert token"
ON push_tokens
FOR INSERT
TO anon
WITH CHECK (true);

-- Block anon SELECT entirely (tokens are private)
CREATE POLICY "Block select tokens"
ON push_tokens
FOR SELECT
TO anon
USING (false);

-- Allow authenticated DELETE (cleanup from server – service role bypasses anyway)
CREATE POLICY "Allow delete tokens"
ON push_tokens
FOR DELETE
TO authenticated
USING (true);


-- ────────────────────────────────────────────────────────────────
-- 2. BOOKINGS
--    INSERT  → anon allowed   (anyone can create a booking)
--    SELECT  → anon allowed   (anyone can read bookings for calendar)
--    UPDATE/DELETE → server only (service role bypasses RLS)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert bookings"
ON bookings
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow read bookings"
ON bookings
FOR SELECT
TO anon
USING (true);


-- ────────────────────────────────────────────────────────────────
-- 3. DEPARTMENTS
--    SELECT  → anon allowed   (needed by booking form)
--    INSERT/UPDATE/DELETE → server only via service role
-- ────────────────────────────────────────────────────────────────

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read departments"
ON departments
FOR SELECT
TO anon
USING (true);


-- ────────────────────────────────────────────────────────────────
-- 4. SETTINGS
--    SELECT  → anon allowed   (reminder / confirmation flags needed client-side)
--    INSERT/UPDATE → server only via service role
-- ────────────────────────────────────────────────────────────────

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read settings"
ON settings
FOR SELECT
TO anon
USING (true);


-- ────────────────────────────────────────────────────────────────
-- 5. SUBSCRIBERS
--    No direct client access — all access is via server API routes
--    which use service role and bypass RLS.
--    Enable RLS and leave no anon policies.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
-- (No anon policies — server uses service role)


-- ────────────────────────────────────────────────────────────────
-- 6. MESSAGE_QUEUE
--    No direct client access — all access is via server API routes.
-- ────────────────────────────────────────────────────────────────

ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;
-- (No anon policies — server uses service role)


-- ────────────────────────────────────────────────────────────────
-- VERIFICATION QUERY
-- Run after applying to confirm RLS is ON for all tables
-- ────────────────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'push_tokens', 'bookings', 'departments',
    'settings', 'subscribers', 'message_queue'
  )
ORDER BY tablename;
