# حالة المشروع (Project Status)

## هدف المشروع
نظام مخصص لإدارة وحجز قاعة الاجتماعات للجهات المختلفة، مزود بتقويم زمني لمنع التعارضات، ونظام إشعارات وتنبيهات آلي للمستخدمين والمدراء، مع إتاحة الخدمة الذاتية لمسؤولي الحجوزات لتعديل أو إلغاء مواعيدهم.

## روابط وبيئات المشروع
- **بيئة الإنتاج (Production):** `https://booking-turath.vercel.app`

## التقنيات الأساسية
- **الواجهة الأمامية والخلفية:** Next.js (App Router).
- **قاعدة البيانات والمصادقة:** Supabase (PostgreSQL).
- **الاستضافة:** Vercel.
- **جدولة المهام (Cron):** cron-job.org.
- **مزودات الإشعارات:** kwtSMS للرسائل النصية، و Firebase/FCM للإشعارات الفورية (Push).

## الوظائف التي تعمل حاليًا
- الحجز المباشر واستعراض الأوقات المتاحة.
- حماية لوحة التحكم بتسجيل الدخول والـ JWT.
- خاصية الإلغاء المرن (Soft Cancel) وتحديث الحجوزات.
- جدولة وتوصيل رسائل التأكيد والتذكيرات النهائية بنجاح (SMS و Push).
- إعادة استخدام الفترات الزمنية للحجوزات الملغاة بشكل آمن.
- المدعوون الإضافيون للحجز (`BOOKING_INVITEES_V1`): إضافة حتى 5 مدعوين وتوصيل رسائل SMS التأكيد والتذكير النهائي.
- التاريخ الافتراضي والأوقات الماضية (`DEFAULT_KUWAIT_DATE_AND_PAST_SLOTS`): تاريخ اليوم في الكويت هو التاريخ الافتراضي، حظر التواريخ والأوقات الماضية، واختيار أقرب وقت متاح مستقبلياً تلقائياً.
- تحصين إدارة المشاركين باللوحة (`PARTICIPANTS_ADMIN_HARDENING`): فحص `response.ok` لمنع النجاح الوهمي، والتقييس الخادمي للهواتف الكويتية، وتجميع واستبعاد التكرار في استيراد Excel.
- وضع الاجتماع الطارئ (`EMERGENCY_MEETING_V1`): حجز فوري عبر جهة نظام خاصة مع إدخال حتى 5 مشاركين إلزاميًا وتوصيل رسائل SMS التأكيد والتذكير.
- الخدمة الذاتية لمسؤولي الحجز (`BOOKING_OWNER_SELF_SERVICE_V1`): استعراض وتعديل وإلغاء المواعيد ذاتياً من الواجهة العامة مع سجل تدقيق خادمي موحد.
- إشعار تعديل الموعد عبر SMS (`RESCHEDULE_SMS_NOTIFICATION_V1`): إرسال SMS فورية وموجزة لمستلمي التأكيد الأصلي الناجحين حصراً عند تعديل الموعد دون زيادة شرائح UCS-2.

## حالة المراحل التشغيلية
- **Stage A:** مكتملة ومختبرة (الاعتماد على حقل `reminder_minutes` للتذكيرات).
- **Stage B:** مكتملة ومختبرة على الإنتاج (حماية مسارات الإلغاء والتعديل، إعادة الجدولة الآلية للإشعارات، استخدام الفهرس الجزئي، و الـ Soft Cancel).
- **Stage C:** مؤجلة ولم تُلغَ (`DEFERRED_NOT_CANCELLED`)، وموضوعها إتاحة تعديل وإلغاء حجوزات الجهة لمسؤول القسم (Department Manager). ميزة `BOOKING_OWNER_SELF_SERVICE_V1` المنفذة ليست Stage C ولا تعني بدء Stage C.
- **BOOKING_INVITEES_V1:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
- **DEFAULT_KUWAIT_DATE_AND_PAST_SLOTS:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
- **PARTICIPANTS_ADMIN_HARDENING:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
- **EMERGENCY_MEETING_V1:**
  - **الحالة:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
  - **أدلة الإنتاج المثبتة:**
    - المسار الأساسي للحجز وتوصيل رسائل التأكيد والتذكير: مثبت بنجاح.
    - استعلام الطوارئ (`EMERGENCY_OWNER_LOOKUP = PASS`): عبر رمز الاجتماع الطارئ وهاتف المشارك المسجل حصراً.
    - تعديل موعد اجتماع طارئ (`EMERGENCY_OWNER_RESCHEDULE = PASS`): إعادة جدولة ناجحة، الحفاظ على المشاركين في `booking_invitees`، ترحيل `final_reminder` للموعد الجديد، وبقاء التأكيد بحالة `sent` دون تكرار.
    - إلغاء اجتماع طارئ مع تذكير معلق (`EMERGENCY_OWNER_CANCEL = PASS`): تحول الحجز إلى `cancelled`، وتحول التذكير المعلق من `pending` إلى `skipped`، وبقاء رسالة التأكيد بحالتها التاريخية `sent`.
    - سجل التدقيق للطوارئ (`EMERGENCY_AUDIT = PASS`): توثيق عمليتي `rescheduled` و `cancelled` بالفاعل `booking_owner`.
- **BOOKING_OWNER_SELF_SERVICE_V1:**
  - **الحالة:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
  - **المعمارية المعتمدة:** تحقق خادمي بسيط ومباشر لكل عملية دون OTP أو JWT أو جلسات أو Tokens أو Snapshots، وإعادة استخدام كاملة لمنطق العمليات المشترك عبر `services/bookingOperationsService.ts`.
  - **أدلة الإنتاج المثبتة للجهات العادية:**
    - استعلام الحجوزات (`REGULAR_OWNER_LOOKUP = PASS`): عبر اختيار الجهة ورمز الـ PIN الخاص بها.
    - تعديل موعد الحجز (`REGULAR_OWNER_RESCHEDULE = PASS`): تعديل الموعد بنجاح، ترحيل التذكير النهائي، وتسجيل التدقيق بـ `actor_type = booking_owner`.
    - إلغاء الحجز (`REGULAR_OWNER_CANCEL = PASS`): تنفيذ Soft Cancel، تحويل التذكيرات المعلقة إلى `skipped`، وتوثيق الإلغاء في سجل التدقيق.
    - سجل التدقيق (`BOOKING_ACTIVITY_AUDIT = PASS`): تسجيل العمليات بدقة وبلا أي بيانات شخصية (No PII).
  - **الواجهة وتجربة المستخدم المثبتة:** زر إدارة الحجز بالصفحة العامة، معالجة استقرار الـ React Hooks، اعتماد ألوان الهوية الخضراء `#097834` مع نص أبيض صريح، توحيد بطاقات الأوقات مع الصفحة الرئيسية (`formatSingleTime`)، تمييز "الموعد الحالي 📌" كعنصر معطل، وإظهار رسائل تأكيد النجاح بعد العمليات.
- **RESCHEDULE_SMS_NOTIFICATION_V1:**
  - **الحالة:** مكتملة ومختبرة على الإنتاج (`COMPLETED_AND_PRODUCTION_VERIFIED`).
  - **ملاحظة التحقق:** التحقق في بيئة الإنتاج يغطي السيناريوهات المختبرة فعلياً (`Production verification covers tested scenarios. Unexecuted edge cases remain explicitly documented. Do not imply 100% scenario coverage`).
  - **الالتزام المنفذ:** `0d719cc` (`feat: notify original booking recipients on reschedule`).
  - **أدلة الإنتاج المثبتة:**
    - تعديل حجز عادي من الخدمة الذاتية (`REGULAR_OWNER_RESCHEDULE_SMS = PASS`): تغيير موعد الحجز، ظهور رسالة النجاح، استلام SMS، تسجيل `message_queue.status = sent`، وتوثيق الفاعل `actor_type = booking_owner`.
    - تعديل الحجز نفسه مرتين متتاليتين (`MULTIPLE_RESCHEDULES = PASS`): استلام رسالتي SMS مستقلتين، كل رسالة تحمل `message_type` مختلفاً، وجود سجلي Audit، وترحيل التذكير النهائي للموعد الأحدث.
    - تعديل الحجز من لوحة الإدارة (`REGULAR_ADMIN_RESCHEDULE_SMS = PASS`): وصول SMS للمستلم الأصلي، وتوثيق الفاعل `actor_type = admin`، وحالة `message_queue.status = sent`.
    - تغيير تاريخ الاجتماع (`DATE_CHANGED_RESCHEDULE_SMS = PASS`): تعديل التاريخ من 19/10/2026 إلى 20/10/2026، استلام النص الدقيق بالتاريخين، تدقيق سليم، وجدولة `final_reminder` قبل الموعد الجديد بساعة.
    - تعديل اجتماع طارئ (`EMERGENCY_OWNER_RESCHEDULE_SMS = PASS`): تعديل موعد الطوارئ، نجاح بالواجهة، وصول SMS للمشارك الأصلي، `actor_type = booking_owner`، وتحديث التذكيرات.
    - حصر نطاق المستلمين في الحالات المختبرة (`RECIPIENT_SCOPE_VERIFICATION = PASS FOR TESTED BOOKINGS ONLY`): مطابقة مستلمي التأكيد الأصلي الناجحين مع مستلمي رسالة التعديل للحجز العادي والاجتماع الطارئ (`original_count = 1, reschedule_sent_count = 1, unexpected_recipients = 0, original_not_sent = 0`). لا تُعمم هذه النتيجة على سيناريوهات تغيير قائمة المشاركين التي لم تُختبر إنتاجياً.

## الالتزامات المرجعية (Commits)
- **إرسال إشعار تعديل الموعد عبر SMS لمستلمي التأكيد الأصليين:** `0d719cc` (feat: notify original booking recipients on reschedule).
- **تحسين تباين زر تأكيد الإلغاء:** `882810a` (style: improve booking cancellation button contrast).
- **توحيد واجهة أوقات التعديل والتغذية الراجعة:** `3a3d2ff` (fix: align reschedule feedback and time slot UI).
- **توحيد ألوان أزرار الخدمة الذاتية مع الهوية:** `8707d8a` (style: align booking management actions with brand colors).
- **إصلاح انهيار الـ Hooks في نافذة إدارة الحجز:** `7326e6c` (fix: prevent booking management modal hooks crash).
- **ميزة الخدمة الذاتية لمسؤولي الحجز:** `239accf` (feat: add self-service booking management).
- **وضع الاجتماع الطارئ:** `8a66985` (feat: add emergency meeting booking mode).
- **تحصين إدارة المشاركين:** `44fe5dc` (fix: harden participant management feedback and phone validation).
- **التاريخ الافتراضي والأوقات الماضية:** `a51768a` (اعتماد توقيت الكويت الافتراضي وحظر الأوقات الماضية).
- **المدعوون الإضافيون:** `4e048ff` (إضافة ميزة المدعوين الإضافيين وتنبيهات SMS).
- **إعادة استخدام الفترات:** `874cef4` (السماح بإعادة الحجز للفترات الملغاة).
- **خط أساس الاستعادة:** `656a634a5516a0b7a9cc7afff7fce36532ef5c9f` (اعتماد خط أساس الاستعادة).

## حالة المشروع الحالية
المشروع في حالة استقرار تشغيلي كامل (`Operational / Production Stable`). الميزات الأساسية والإضافية معتمدة ومثبتة بالكامل في بيئة الإنتاج: المدعوون الإضافيون (`BOOKING_INVITEES_V1`)، التوقيت الكويتي وحظر الفترات الماضية (`DEFAULT_KUWAIT_DATE_AND_PAST_SLOTS`)، تحصين المشاركين (`PARTICIPANTS_ADMIN_HARDENING`)، وضع الاجتماع الطارئ (`EMERGENCY_MEETING_V1`)، الخدمة الذاتية لمسؤولي الحجز (`BOOKING_OWNER_SELF_SERVICE_V1`)، وإشعار تعديل الموعد عبر SMS لمستلمي التأكيد الأصليين (`RESCHEDULE_SMS_NOTIFICATION_V1`). المرحلة الثالثة (Stage C) تظل مؤجلة بصراحة ولم تُلغَ (`DEFERRED_NOT_CANCELLED`).
