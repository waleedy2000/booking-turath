-- ================================================
-- Migration: Department Managers
-- Run in Supabase SQL Editor
-- ================================================

CREATE TABLE IF NOT EXISTS department_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  manager_name TEXT,
  manager_phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, manager_phone)
);

CREATE INDEX IF NOT EXISTS idx_department_managers_phone
ON department_managers(manager_phone);

CREATE INDEX IF NOT EXISTS idx_department_managers_dept_active
ON department_managers(department_id, is_active);

ALTER TABLE department_managers ENABLE ROW LEVEL SECURITY;

-- No public policies are added. Server routes use the service role.
