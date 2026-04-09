-- إنشاء جدول الجهات (Departments)
CREATE TABLE IF NOT EXISTS departments (
  name TEXT PRIMARY KEY,
  pin_code TEXT NOT NULL
);

-- إدخال بعض البيانات التجريبية
INSERT INTO departments (name, pin_code) VALUES
  ('مجلس الإدارة', '1111'),
  ('الكلمة الطيبة', '2222'),
  ('الاستقطاعات', '3333'),
  ('المشاريع', '4444'),
  ('ضبط الجودة', '5555'),
  ('الإعلامية والتسويق', '6666'),
  ('الاستقبال', '7777'),
  ('مركز التحفيظ', '8888'),
  ('اللجنة العلمية', '9999'),
  ('النشء والشباب', '0000')
ON CONFLICT (name) DO NOTHING;

-- 3. Notification Subscribers Table
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null
);

-- 4. Message Queue Table
create table if not exists message_queue (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  message text not null,
  status text default 'pending', -- pending | sent | failed
  attempts int default 0,
  created_at timestamp default now()
);

-- إنشاء جدول الحجوزات (Bookings) يعتمد على time slot محدد
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT REFERENCES departments(name) NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

-- إضافة عمود التذكير لمنع تكرار الإرسال
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

