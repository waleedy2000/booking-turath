# المعمارية والتشغيل (Architecture and Operations)

## مسار الطلب الأساسي (Request Flow)
يعتمد النظام على هيكلية خادمية بشكل كامل للعمليات الحساسة:
- **المسار:** Browser → Next.js API → Supabase.
- لا يتصل المتصفح بقواعد البيانات لتنفيذ العمليات مباشرة.

## البنية التحتية والاستضافة
- **Vercel:** استضافة الواجهة الأمامية والمسارات الخادمية (API Routes).
- **GitHub:** مستودع الشيفرة المصدرية (Source Control).
- **Supabase:** قاعدة البيانات (PostgreSQL) ونظام المصادقة (Auth).
- **cron-job.org:** خدمة خارجية لاستدعاء المهام المجدولة (Cron Jobs).
- **kwtSMS:** مزود خدمة إرسال الرسائل النصية القصيرة (SMS) للإنتاج.
- **Firebase / FCM:** مخصص لإرسال الإشعارات الفورية (Push Notifications) فقط.

## المهام المجدولة (Cron Jobs)
تُستدعى المهام تلقائياً عبر `cron-job.org` بمعدل تكرار **كل 5 دقائق**.
- **المسارات المخصصة:**
  - `GET /api/reminders`
  - `GET /api/send-queue`

## المصادقة والأمان
- **تسجيل الدخول:** يتم حماية لوحة إدارة المشرف العام (Admin) عبر جلسات آمنة باستخدام JWT.
- **حالة أمان قاعدة البيانات (RLS State):**
  - مُفعّل (`enabled`) على جميع جداول public الأساسية.
  - لا توجد أي سياسات مكتوبة (`no policies`).
  - النتيجة الفعلية للوصول المباشر: الرفض الافتراضي (`Default Deny`).
- **مسار العمليات:** جميع العمليات تمر حصرياً عبر الخادم (Server) باستخدام صلاحيات مرتفعة (Service Role)، وهو ما يمنع وصول المستخدمين مجهولي الهوية (anon) أو المسجلين (authenticated) من إجراء تعديلات مباشرة.
- **مسار حسم المستلمين (Recipient Resolution Flow):**
  `مسؤول الحجز (Booking Contact) + المشاركون الفاعلون (Department Participants) + المدعوون الإضافيون (Booking Invitees) ← التقييس (Normalize) ← منع التكرار (Deduplicate) ← booking_notification_events ← kwtSMS`
- **خاصية المدعوين (`booking_invitees`):** يتم التعامل مع جدول المدعوين حصرياً عبر الخادم (Server-side only)، مع تفعيل RLS بدون سياسات عامة (Default Deny). يحصل المدعوون على إشعارات SMS فقط (تأكيد وتذكير نهائي)، والإشعارات الفورية (Push) غير مستخدمة لهم في V1.
- **السلطة الزمنية (Time Authority):** تعتبر `Asia/Kuwait` (غرينتش +3) السلطة الزمنية الصريحة للحسابات الحالية للتواريخ والأوقات في مسار الحجز عبر المساعد المركزي `lib/kuwait-time.ts`. يطبق الواجهة ومحرك الفترات والـ API الخادمي قاعدة منع الحجز في الأوقات والتواريخ الماضية بصورة مستقلة ومزدوجة.
- **صلاحيات الجداول (Grants):** تم منح صلاحيات واسعة (مثل TRUNCATE و INSERT و UPDATE) للأدوار الافتراضية، ورغم أنها لا تتجاوز حماية RLS لعمليات الصفوف وتعتبر غير حاجبة لسير العمل، إلا أنها مُصنفة كمراجعة أمنية متأخرة (`SECURITY_HARDENING_REVIEW`).

## متغيرات البيئة المطلوبة (Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- مفاتيح وبيانات الاعتماد الخاصة بـ `kwtSMS` و `Firebase`.
