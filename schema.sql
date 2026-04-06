-- إنشاء جدول الجهات (Departments)
CREATE TABLE IF NOT EXISTS departments (
  name TEXT PRIMARY KEY,
  pin_code TEXT NOT NULL
);

-- إدخال بعض البيانات التجريبية
INSERT INTO departments (name, pin_code) VALUES
  ('القسم التقني', '1234'),
  ('الموارد البشرية', '5678'),
  ('الإدارة المالية', '9012')
ON CONFLICT (name) DO NOTHING;

-- إنشاء جدول الحجوزات (Bookings) يعتمد على time slot محدد
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT REFERENCES departments(name) NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL
);

-- لمنع تكرار الحجز لنفس اليوم والوقت تماماً (منع التعارض) 
-- يمكننا إضافة Unique Constraint
ALTER TABLE bookings
  ADD CONSTRAINT unique_booking_time UNIQUE (date, time);
