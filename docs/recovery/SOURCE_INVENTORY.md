# تقرير مصادر الأدلة والجرد (Source Inventory)
تم إجراء هذا الجرد بناءً على تدقيق شامل لمجلدات المشروع، وسجلات الـ Git، ومصادر الحقيقة المدخلة والمصادر التاريخية الخارجية.

## 1. المصادر المحلية المقروءة فعليًا (Local Files Read)
تم فتح وقراءة محتوى الملفات التالية بالكامل من مسار المشروع:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `schema.sql`
- `migration_allow_rebooking_cancelled_slots.sql`
- `migration_booking_notification_events.sql`
- `migration_department_managers.sql`
- `migration_fix_bookings.sql`
- `migration_phone_identity.sql`
- `migration_rls_security.sql`
- `migration_roles.sql`
- `migration_soft_cancel.sql`
- `migration_targeted_notifications.sql`
- `migration_unique_bookings.sql`
- `audit_booking_contact_phones.sql`
- `cleanup_early_reminders.sql`
- `execute_reschedule_pending_final_reminders.sql`
- `post_implementation_audit.sql`
- `reschedule_pending_final_reminders.sql`

## 2. المصادر التاريخية الخارجية (External Historical Sources)
تم استخراج وفحص هذه الملفات من المسار الخارجي المرجعي `legacy-docs`. تم تغيير حالتها إلى: `External historical source — read and inventoried`.
*تنبيه: (contains_sensitive_operational_data = yes) تم حجب البيانات الحساسة.*

- `PROJECT_MASTER.md` (مقروء بالكامل - `architecture_note`)
- `NOTIFICATION_SYSTEM.md` (مقروء بالكامل - `architecture_note`)
- `توثيق.md` إلى `توثيق6.md` و `توثيق5.txt` (مقروءة بالكامل - `implementation_report`)
- `SMS Gateway للمشاريع.txt` (مقروء بالكامل - `historical_document`)
- `تنظيم مواعيد حجز قاعة.txt` (مقروء بالكامل - `conversation_export`)
- `نظام حجوزات Gemini.txt` (مقروء بالكامل - `conversation_export`)
- `شعار المشروع والتنسيق.txt` (مقروء بالكامل - `operational_note`)
- `README_SOURCE_ONLY.md` (مقروء بالكامل - `historical_document`)

## 3. الالتزامات المستخدمة كدليل (Git Commits)
- `69361dc` : حماية الأدمن.
- `2916b0c` : تقصير رسائل SMS.
- `65cc4da` : إعادة جدولة التذكيرات النهائية.
- `874cef4` : السماح بإعادة الحجز للفترات الملغاة (وهو HEAD الحالي للفرع `main`).

## 4. ملفات الكود التي استُخدمت كأدلة (Code Evidence)
- `lib/booking-notification-events.ts` (يحتوي على الدالة `rescheduleFinalReminders`).
- `app/api/bookings/route.ts` (يحتوي على الدالة `isActiveBookingForConflict`).
- `lib/admin-auth.ts` و `proxy.ts` و `app/api/settings/route.ts` (لحماية مسارات الـ API).
- مجلد `app/api/` (لإثبات مسارات التطبيق).

## 5. الحقائق المؤكدة من المالك والقرارات (Owner-Confirmed Production Facts & Decisions)

### أ. حالة المشروع والمراحل (Project State)
- دفع الكود إلى `origin/main` والنشر على `booking-turath.vercel.app`.
- اكتمال مراحل العمل (Stage A و Stage B) واختبارها على الإنتاج بنجاح.
- إجراء تعديلات وإلغاءات ناجحة أدت إلى إعادة الجدولة وإلغاء التنبيهات في الإنتاج بدقة.
- إسقاط القيد `unique_booking_slot` ونجاح إعادة الحجز الفعلي.
- اعتماد منصة cron-job.org بتردد 5 دقائق.
- **Stage C:** 
  - `DEFERRED_NOT_CANCELLED`
  - Evidence: `OWNER_CONFIRMED_DECISION`

### ب. الإشعارات (Push/SMS)
- مزود الإنتاج الحالي لرسائل الـ SMS هو kwtSMS.
- **القرار:** SMS مختصرة بسبب تكلفة الشرائح. Push مفصلة لأنها لا تخضع لتكلفة شرائح SMS.
- Evidence: `OWNER_CONFIRMED_DECISION`

### ج. أمان قواعد البيانات (Production RLS)
- Evidence type: `OWNER_CONFIRMED_PRODUCTION_FACT`
- RLS enabled على جداول public التسعة.
- لا توجد Policies.
- Default Deny للأدوار الخاضعة لـ RLS.
- Grants الواسعة موجودة، لكنها لا تسمح بعمليات الصفوف دون Policies.
- Least Privilege Review مؤجلة وغير حاجبة.
