-- 📌 مرحبًا بك في نظام التحقق (Post-Implementation Audit)

-- ==============================================
-- 1️⃣ التحليلات والتحقق (Queries)
-- ==============================================

-- 1. تحقق من العلاقات بين Tokens والـ User والجهة
select pt.token, u.phone, d.name
from push_tokens pt
join users u on pt.user_id = u.id
left join departments d on u.entity_id = d.id;

-- 2. إيجاد التوكنات القديمة (بدون مستخدم)
select * from push_tokens
where user_id is null;

-- 3. إيجاد التوكنات المكررة لنفس الجهاز
select token, count(*)
from push_tokens
group by token
having count(*) > 1;

-- ==============================================
-- 2️⃣ تنظيف البيانات (Clean Up)
-- ==============================================

-- إزالة التوكنات المهجورة
delete from push_tokens
where user_id is null;

-- إزالة التكرار إن وجد
delete from push_tokens a
using push_tokens b
where a.ctid < b.ctid
and a.token = b.token;

-- ==============================================
-- 3️⃣ قيود التحسين (Constraints & Indexes)
-- ==============================================

-- ضمان عدم إضافة توكن مكرر في المستقبل (DB Level)
create unique index if not exists unique_token
on push_tokens(token);

-- (اختياري) إجبار وجود جهة لكل مستخدم تم تفعيله
-- alter table users
-- add constraint users_entity_not_null
-- check (entity_id is not null);

-- ==============================================
-- 4️⃣ بناء جدول الـ Logs
-- ==============================================

create table if not exists notification_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid references departments(id),
  title text,
  body text,
  created_at timestamp default now()
);

-- تعديل الـ Logs لإضافة مستشعرات الخطأ والمراقبة (Observability)
alter table notification_logs
add column if not exists status text default 'sent',
add column if not exists error text,
add column if not exists type text default 'booking';

-- ==============================================
-- 5️⃣ إضافة أعمدة التحكم للإشعارات في جدول settings
-- ==============================================
alter table settings
add column if not exists enable_notifications boolean default true,
add column if not exists enable_booking_notifications boolean default true;

-- ==============================================
-- 6️⃣ نظام التذكير الذكي (Smart Reminders Engine)
-- ==============================================
alter table bookings
add column if not exists reminder_sent boolean default false;

create index if not exists idx_bookings_reminder
on bookings(reminder_sent, start_time);

-- ==============================================
-- انتهى التحقق
-- ==============================================
