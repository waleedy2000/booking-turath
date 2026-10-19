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
- **تسجيل الدخول الإداري:** يتم حماية لوحة إدارة المشرف العام (Admin) عبر جلسات آمنة باستخدام JWT. مسارات الأدمن `PUT /api/bookings` و `DELETE /api/bookings` تظل محمية حصرياً للمشرف العام ولا تُفتح للعامة.
- **حالة أمان قاعدة البيانات (RLS State):**
  - مُفعّل (`enabled`) على جميع جداول public الأساسية وجدول سجل التدقيق `booking_activity_log`.
  - لا توجد أي سياسات عامة مكتوبة (`no public policies`).
  - النتيجة الفعلية للوصول المباشر: الرفض الافتراضي (`Default Deny`).
- **مسار العمليات:** جميع العمليات تمر حصرياً عبر الخادم (Server) باستخدام صلاحيات مرتفعة (Service Role)، وهو ما يمنع وصول المستخدمين مجهولي الهوية (anon) أو المسجلين (authenticated) من إجراء تعديلات مباشرة.
- **مسار حسم المستلمين (Recipient Resolution Flow):**
  `مسؤول الحجز (Booking Contact) + المشاركون الفاعلون (Department Participants) + المدعوون الإضافيون (Booking Invitees) ← التقييس (Normalize) ← منع التكرار (Deduplicate) ← booking_notification_events ← kwtSMS`
- **خاصية المدعوين (`booking_invitees`):** يتم التعامل مع جدول المدعوين حصرياً عبر الخادم (Server-side only)، مع تفعيل RLS بدون سياسات عامة (Default Deny). يحصل المدعوون على إشعارات SMS فقط (تأكيد وتذكير نهائي)، والإشعارات الفورية (Push) غير مستخدمة لهم في V1.
- **حماية الخصوصية (Privacy & Calendar):** مسار الاستعلام العام `GET /api/bookings` يقرأ من جدول `bookings` فقط ولا يستعلم من جدول `booking_invitees`، مما يضمن عدم كشف أرقام هواتف المدعوين أو المشاركين في التقويم وسجلات المتصفح العامة.
- **السلطة الزمنية (Time Authority):** تعتبر `Asia/Kuwait` (غرينتش +3) السلطة الزمنية الصريحة للحسابات الحالية للتواريخ والأوقات في مسار الحجز عبر المساعد المركزي `lib/kuwait-time.ts`. يطبق الواجهة ومحرك الفترات والـ API الخادمي قاعدة منع الحجز في الأوقات والتواريخ الماضية بصورة مستقلة ومزدوجة.
- **صلاحيات الجداول (Grants):** تم منح صلاحيات واسعة (مثل TRUNCATE و INSERT و UPDATE) للأدوار الافتراضية، ورغم أنها لا تتجاوز حماية RLS لعمليات الصفوف وتعتبر غير حاجبة لسير العمل، إلا أنها مُصنفة كمراجعة أمنية متأخرة (`SECURITY_HARDENING_REVIEW`).

## معمارية الخدمة الذاتية لمسؤولي الحجز (BOOKING_OWNER_SELF_SERVICE_V1)
- **المعمارية البسيطة المعتمدة (No Session / Stateless):**
  - لا يوجد OTP، ولا JWT خاص بمسؤول الحجز، ولا Management Session، ولا Management Token، ولا توثيق إضافي عبر SMS، ولا تخزين snapshot لهاتف المالك.
  - كل عملية تعديل أو إلغاء (Mutation) تعيد التحقق الأمني الكامل خادمياً (Server-side) في نفس الطلب.
- **مسار التحقق من الملكية:**
  - **الحجز العادي (Regular):** مطابقة الجهة ورمز الـ PIN الخاص بها خادمياً، والتحقق الصارم من انتماء الحجز للجهة عبر `department_id` (مع دعم توافقي لـ `department_name` للحجوزات القديمة فقط).
  - **الاجتماع الطارئ (Emergency):** مطابقة رمز الاجتماع الطارئ الخاص بجهة الطوارئ، والتأكد الخادمي من وجود رقم هاتف المشارك المقيس (`normalizeKuwaitiPhone`) مسجلاً ضمن `booking_invitees` التابع لنفس `booking_id`.
- **واجهة الخدمة الذاتية البرمجية (Self-Service API):**
  - مسار مستقل ومخصص: `POST /api/booking-management`.
  - يدعم العمليات الثلاث:
    - `lookup`: جلب الحجوزات المستقبلية النشطة العائدة لصاحب الصلاحية.
    - `reschedule`: تعديل موعد الحجز وتحديث التذكيرات وتوثيق العملية في سجل التدقيق.
    - `cancel`: إلغاء الحجز المرن وتخطي التذكيرات المعلقة وتوثيق العملية.
- **منطق الأعمال المشترك (Shared Business Logic):**
  - يعتمد كل من المشرف العام (Admin) ومسؤول الحجز (Booking Owner) على نفس المنطق الخادمي المشترك المنفذ في `services/bookingOperationsService.ts`:
    - `executeBookingReschedule`: لفحص التعارضات، وتطبيق قواعد التوقيت الكويتي، وإعادة جدولة التذكيرات النهائية، وتوثيق سجل النشاط.
    - `executeBookingCancel`: لتنفيذ الـ Soft Cancel، وتحويل التذكيرات المعلقة إلى `skipped`، وتوثيق سجل النشاط.
  - يقتصر الاختلاف بين الأدمن وصاحب الحجز على طبقة المصادقة والصلاحيات (Authorization) فقط، مع تمرير `actor_type` المناسب (`admin` أو `booking_owner`).
  - هذا الفصل يضمن منع ازدواجية كود التحقق وقواعد التوقيت وتفادي أي انحراف منطقي بين اللوحة والواجهة العامة.

## معمارية الاجتماع الطارئ (EMERGENCY_MEETING_V1 Architecture)
- **التصميم المعتمد (Special System Department):**
  اعتماد نمط "جهة النظام الخاصة" باسم `اجتماع طارئ` بدلاً من إنشاء عمود أصيل `booking_type`، لتفادي تعديل Schema قاعدة البيانات وتقليل مخاطر الـ Regression.
- **الثابت المركزي:**
  يتم تعريف الاسم حصرياً داخل `lib/booking-constants.ts` عبر الثابت `EMERGENCY_DEPARTMENT_NAME` دون تكرار النصوص الحرفية في الكود.
- **إعادة استخدام الجداول:**
  لا يوجد جدول موازٍ باسم `emergency_participants`؛ يعاد استخدام جدول `booking_invitees` لتخزين أرقام المشاركين.
- **تدفق الحجز الطارئ:**
  `Emergency UI → EMERGENCY_DEPARTMENT_NAME → رمز PIN المخصص للجهة → التحقق الزمني والتعارضات كالحجز العادي → bookings → booking_invitees → getBookingNotificationRecipients → booking_notification_events → kwtSMS`
- **حسم المستلمين والإشعارات:**
  - جهة النظام لا تملك رقم هاتف أو مسؤول حجز (`phone = NULL`, `booking_contact_phone = NULL`).
  - جهة النظام لا تملك مشاركين دائمين في `department_participants`.
  - مستلمو رسائل SMS هم مشاركو الحجز المسجلون في `booking_invitees` فقط.
  - مستلمو إشعارات Push هم 0 بشكل طبيعي دون الحاجة لتفريغ شرطي خاص داخل محرك الإشعارات.
- **سلوك واجهة المستخدم (UI Behavior):**
  - وضع `حجز جهة` (Regular) هو الوضع الافتراضي.
  - وضع `اجتماع طارئ` (Emergency) يخفي القائمة المنسدلة للجهات ويعتمد جهة الطوارئ داخلياً، ويغيّر تسمية الرمز إلى "رمز الاجتماع الطارئ".
  - إظهار حقول المشاركين إلزاميًا (الاسم اختياري، ورقم الهاتف إلزامي)، بحد أدنى مشارك واحد وحد أقصى 5 مشاركين.
  - تطبيق تصفير كامل للحالة (State Reset) عند التبديل بين الوضعين لمنع تسرب البيانات أو الـ PIN أو المدعوين.
- **فلترة القوائم العامة:**
  يستبعد مسار `GET /api/departments` جهة النظام برمجياً في الذاكرة لمنع ظهورها في القوائم المنسدلة العادية أو شاشات إدارة الأقسام.

## معمارية إشعار تعديل الموعد (RESCHEDULE_SMS_NOTIFICATION_V1 Architecture)
- **مصدر الحقيقة لمستلمي التعديل (Recipient Source of Truth):**
  - يُستخرج المستلمون حصرياً من جدول أحداث الإشعارات السابق `booking_notification_events` وفق الشروط الصارمة:
    `booking_id = target_booking AND channel = 'sms' AND stage = 'confirmation' AND status = 'sent' AND sent_at IS NOT NULL`
  - تمر كافة الأرقام عبر التقييس الخادمي الموحد `normalizeKuwaitiPhone` ومنع التكرار عبر `Set`.
  - **حظر التوسع وإعادة الحساب:** لا تعتمد رسالة التعديل على دالة `getBookingNotificationRecipients`، ولا على المشاركين الحاليين للجهة، ولا على مسؤولي الحجز الحاليين، مما يضمن عدم وصول الرسالة لأي مشارك أضيف للجهة بعد إنشاء الحجز (`NO BROADCAST / NO RECIPIENT EXPANSION`).
  - **المعنى التشغيلي لحالة `sent`:** تعني قبول الرسالة بنجاح من مزود الخدمة (`ORIGINAL_CONFIRMATION_SUCCESSFULLY_SENT_BY_SYSTEM`). لا يوفر النظام Handset Delivery Receipt يثبت التسليم النهائي أو القراءة على جهاز كل مستلم.
- **تدفق الإرسال والطابور (Queue Flow):**
  - يتم إدراج الرسائل عبر `enqueueSms` في جدول `message_queue` ثم استدعاء المعالجة الفورية `processSmsQueue` للاتصال بـ `kwtSMS`.
  - **إرسال غير حاجب (Non-blocking):** فشل إرسال SMS لا يُسقط الحجز، ولا يتراجع عن التعديل في قاعدة البيانات، ولا يلغي التذكيرات أو التدقيق، وتبقى استجابة الـ API ناجحة (`HTTP 200`).
  - تخضع الرسائل المتعثرة لآلية إعادة المحاولة المدمجة في طابور الرسائل القائم عند استدعاء `/api/send-queue` دورياً.
- **مفتاح العملية ومنع التصادم (Operation Key / Idempotency):**
  - يتم توليد مفتاح حتمي فريد للعملية:
    `message_type = reschedule:<bookingId>:<mutationTimestamp>`
    حيث يمثل `mutationTimestamp` الختم الزمني الحقيقي المكتوب في حقل `bookings.updated_at`.
  - هذا المفتاح يمنع الحجب المتبادل بين حجوزات مختلفة تستخدم نفس الأوقات (`NO CROSS-BOOKING COLLISION`)، ويدعم تعدد التعديلات المتتالية لنفس الحجز (`MULTIPLE RESCHEDULES`).
- **حماية التزامن ومنع الطفرات الوهمية (Optimistic Concurrency & No-Op Guard):**
  - **No-Op Guard:** التحقق المسبق مما إذا كان الموعد المطلوب يطابق الموعد المسجل حالياً للحجز النشط؛ وفي حال التطابق يُعاد نجاح فوري دون أي كتابة في قاعدة البيانات ودون إدراج Audit أو إرسال SMS.
  - **Optimistic Update:** يتم تحديث الحجز باشتراط مطابقة الحالة السابقة:
    `WHERE id = bookingId AND date = oldDate AND start_time = oldStartTime AND end_time = oldEndTime AND status = oldStatus`
    (مع استخدام `.is('status', null)` للحجوزات القديمة ذات الحالة الفارغة).
  - **حماية الإلغاء المتزامن (Cancel vs Reschedule Race):** إذا ألغي الحجز بالتزامن قبل الـ Update، تفشل العملية ويعاد رفض صريح بكود `400` ولا يُعامل كـ No-Op Success.
- **استقرار المعمارية والـ Zero Drift:**
  - لم يتم تغيير معمارية رسائل التأكيد (`confirmation`) أو التذكير النهائي (`final_reminder`).
  - صفر تعديلات على Schema أو Migrations لقواعد البيانات، وصفر تعديلات على واجهات المستخدم (Zero UI changes).

## متغيرات البيئة المطلوبة (Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- مفاتيح وبيانات الاعتماد الخاصة بـ `kwtSMS` و `Firebase`.
