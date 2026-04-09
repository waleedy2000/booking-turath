-- 1. إضافة رقم الهاتف لجدول الجهات
ALTER TABLE departments ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. إضافة نوع الرسالة ووقت الجدولة لجدول الطابور
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. إنشاء جدول الإعدادات
CREATE TABLE IF NOT EXISTS settings (
  id uuid primary key default gen_random_uuid(),
  enable_confirmation boolean default true,
  enable_reminder boolean default true,
  reminder_minutes int default 30
);

-- إدخال صف افتراضي للإعدادات إذا كان الجدول فارغاً
INSERT INTO settings (id, enable_confirmation, enable_reminder, reminder_minutes)
SELECT gen_random_uuid(), true, true, 30
WHERE NOT EXISTS (SELECT 1 FROM settings);
