# خط الأساس للإنتاج والكود (CODE & PRODUCTION BASELINE)
التاريخ: 2026-08-02
المشروع: نظام حجز قاعة الاجتماعات (C:\booking-room)

## 1. الحالة الحالية للفرع والالتزامات (Git Commits)
- **الفرع الحالي:** `main` (مُثبت محليًا)
- **التخزين السحابي:** تم الدفع (Push) إلى `origin/main`. *(OWNER_CONFIRMED_PRODUCTION_FACT)*
- **رابط الإنتاج:** https://booking-turath.vercel.app *(OWNER_CONFIRMED_PRODUCTION_FACT)*

### الالتزامات (Commits) المعتمدة حديثًا (مُثبتة محليًا):
1. **السماح بإعادة الحجز في الفترات الملغاة:** `874cef4`
2. **إعادة جدولة التذكيرات بعد تعديل الحجز:** `65cc4da`
3. **تقصير رسائل SMS لرسالة واحدة:** `2916b0c`
4. **حماية الأدمن وفرض قواعد الحجز:** `69361dc`

## 2. المراحل التشغيلية
- **Stage A:** الاعتماد على حقل `reminder_minutes` للتذكير النهائي (القيمة الحالية: 60 دقيقة). *(مكتملة ومختبرة تشغيليًا - OWNER_CONFIRMED_PRODUCTION_FACT)*
- **Stage B:** 
  - حماية مسارات الإلغاء والتعديل والإعدادات (مُثبت في `lib/admin-auth.ts`).
  - تعديل مواعيد الحجوزات وإعادة جدولة التذكير (`rescheduleFinalReminders` في الكود).
  - Soft Cancel للحجوزات (مُثبت في Migration و API).
  - إعادة استخدام أوقات الحجوزات الملغاة (مُثبت في `isActiveBookingForConflict` و `unique_active_booking_slot`).
  *(مكتملة ومختبرة على الإنتاج - OWNER_CONFIRMED_PRODUCTION_FACT)*
- **Stage C:** 
  - **الحالة:** `DEFERRED_NOT_CANCELLED`
  - **نوع الدليل:** `OWNER_CONFIRMED_DECISION`
  - **القرار الحالي:** عدم البدء بها الآن.
  - **الموضوع:** إتاحة تعديل وإلغاء حجوزات الجهة لمسؤول القسم.

## 3. إعدادات الإشعارات (SMS)
- **مزود الخدمة:** kwtSMS للإنتاج. *(OWNER_CONFIRMED_PRODUCTION_FACT)* (ملف `sms-service.ts` يدعم ذلك).
- **عدم وجود اعتماد:** تم التأكد من عدم وجود اعتماد حالي على Android SMS Gateway كمزود للإنتاج.
- **قيود الـ SMS:** طول الرسالة يقل عن 70 وحدة بدون إيموجي أو فواصل.
- **التأكيد (Confirmation):** 58 حرف. *(OWNER_CONFIRMED_PRODUCTION_FACT)*
- **التذكير النهائي (Final Reminder):** 63 حرف. *(OWNER_CONFIRMED_PRODUCTION_FACT)*
- **ملاحظة:** إشعارات Push تحتفظ بطولها والأيقونات بشكل مستقل.

## 4. نظام الإشعارات وجدول الأحداث (Supabase)
- **جدول الإشعارات:** `booking_notification_events` (موجود في ملفات Migration والكود).
- **القيد الفريد:** `UNIQUE (booking_id, phone, channel, stage)` 
  - يُستدعى التعديل (upsert) بناءً عليه لصف `final_reminder`. 
- **دالة `rescheduleFinalReminders` (مُثبتة في الكود):**
  - لا ينشأ حدث `confirmation` جديد عند التعديل، ولا `early_reminder` (وهو غير موجود ضمن المسار الحالي).
  - `scheduled_at` يضبط على الموعد ناقص `reminder_minutes`.
  - تُعاد حالة `final_reminder` إلى `pending` وتُحذف أخطاء `error`.
- **منطق الإلغاء:** التذكيرات المعلقة `pending` تتحول لـ `skipped`.

## 5. قواعد الحجوزات (Constraints)
- **الفهرس الحالي:** `unique_active_booking_slot`
  *(مُثبت محليًا في `migration_allow_rebooking_cancelled_slots.sql` و OWNER_CONFIRMED_PRODUCTION_FACT على إسقاط القيد القديم من Supabase).*
- **دالة `isActiveBookingForConflict` (مُثبتة في الكود):**
  - تستخدم فلتر `status !== 'cancelled'` بدلاً من فلتر Supabase القديم للسماح بإعادة الحجز.

## 6. البنية التشغيلية 
- **المهام الخارجية (Cron):** cron-job.org بتردد 5 دقائق والمصادقة بـ `CRON_SECRET`. *(OWNER_CONFIRMED_PRODUCTION_FACT)*
- **المسارات المعتمدة في الكود:** 
  - `/api/reminders`
  - `/api/send-queue`
  - `/api/bookings`
  - `/api/settings`
  - `/api/auth/login`

## 7. نتائج الاختبارات التشغيلية
- تجربة إلغاء وتعديل حجز: تمت بنجاح، ونتج عنها `final_reminder status = skipped` و `confirmation status = sent`.
- تجربة إعادة الحجز: الحجز الجديد `confirmed` والقديم `cancelled`. 
*(جميع الاختبارات: OWNER_CONFIRMED_PRODUCTION_FACT)*

## 8. Production RLS State

نوع الدليل:
OWNER_CONFIRMED_PRODUCTION_FACT

النتائج الفعلية من Supabase بتاريخ 2026-08-02:
- RLS مفعّل على جميع جداول public التالية:
  - booking_notification_events
  - bookings
  - department_managers
  - department_participants
  - departments
  - message_queue
  - push_tokens
  - settings
  - subscribers

- rls_forced = false لكل الجداول.
- pg_policies لا يحتوي أي سياسة لهذه الجداول.
- النتيجة الفعلية للأدوار الخاضعة لـ RLS: Default Deny.
- anon وauthenticated لا يستطيعان تنفيذ عمليات الصفوف مباشرة (SELECT, INSERT, UPDATE, DELETE) لأن الصلاحيات الجدولية وحدها لا تكفي دون سياسة RLS.
- عمليات التطبيق الحالية تمر عبر مسارات Next.js الخادمية واتصال خادم ذي صلاحية مرتفعة.
- لا تدّع وجود سياسة SELECT أو INSERT عامة حاليًا.
- لا تدّع أن المتصفح يتصل بالجداول مباشرة.

**ملاحظة (SECURITY_HARDENING_REVIEW):**
- anon وauthenticated لديهما Grants واسعة على مستوى الجدول، تشمل: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.
- هذه Grants لا تتجاوز RLS بالنسبة لعمليات الصفوف.
- وجود TRUNCATE والصلاحيات الواسعة يحتاج مراجعة Least Privilege لاحقة.
- (هذه مراجعة أمنية غير حاجبة، ولا تصف كثغرة مؤكدة. لا تنفذ REVOKE الآن. يلزم قبل أي تغيير مراجعة: RPC functions, SECURITY DEFINER functions, integrations, server-side clients).
