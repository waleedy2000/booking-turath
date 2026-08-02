# قرارات المشروع الأصلية (Original Project Decisions)
مستخرجة من المصادر التاريخية (Legacy Docs) فقط، مع تصنيف دقيق لحالة التنفيذ والقرارات.

## الهدف الأصلي للمشروع
- نظام حجز قاعة اجتماعات للجهات مع تقويم زمني يمنع التعارضات.
- **التصنيف:** `REQUIREMENT`

## الجهات والمستخدمون
- المشرف العام (Admin): يدير الحجوزات والجهات والأيام.
- مسؤول القسم (Department Manager): يمكنه إدارة حجوزات جهته فقط (تعديل، إلغاء).
- المستخدم العام: يمكنه عرض المتاح وإتمام الحجز.
- **التصنيف:** `REQUIREMENT`
- إتاحة الإلغاء وتعديل الحجوزات لمسؤول القسم (Stage C).
- **التصنيف:** `OWNER_CONFIRMED_DECISION` (`DEFERRED_NOT_CANCELLED`).

## أوقات الحجز ومدة الحجز وقواعد التداخل
- أوقات محددة تبدأ من 09:30 صباحاً إلى 02:00 ظهراً بزيادات 30 دقيقة (Time Slots).
- منع تام للحجز المزدوج (Double Booking) في نفس الوقت واليوم (Conflict Logic).
- **التصنيف:** `APPROVED_DECISION`

## التصميم والهوية البصرية
- ألوان الواجهة: الأزرق الداكن (#003366)، الذهبي (#D4AF37)، الأبيض/الرمادي.
- خط الكتابة: Tajawal.
- واجهة مستخدم (UI) نظيفة بخاصية Soft Cancel كالبطاقات المخفية جزئياً.
- **التصنيف:** `APPROVED_DECISION`

## بنية الإشعارات
- تذكير مبكر قبل 24 ساعة (early_reminder)، ثم تأكيد (confirmation)، ثم تذكير قبل الموعد بـ 30 دقيقة.
- **التصنيف:** `OBSOLETE_DECISION` (الآن 60 دقيقة ولا يوجد مبكر).
- رسائل Push للإشعارات التفصيلية مع Emoji.
- **التصنيف:** `OWNER_CONFIRMED_DECISION` (رسائل Push تبقى مفصلة لأنها لا تخضع لتكلفة شرائح SMS، بينما تُختصر SMS لتقليل التكلفة).

## مزودات SMS التي نوقشت
- تطبيق Android SMS Gateway المخصص ليعمل كجسر رخيص التكلفة.
- **التصنيف:** `PROPOSAL` / `OBSOLETE_DECISION` (Android Gateway كان للرسائل SMS واستبدل بـ kwtSMS كمزود إنتاجي).
- استخدام Firebase/FCM.
- **التصنيف:** `APPROVED_DECISION` (كان مخصصاً للإشعارات Push).

## بنية Push
- ربط الأجهزة بـ `push_tokens` مع تحديد هوية (phone, token, user_id).
- **التصنيف:** `APPROVED_DECISION`

## RLS والحماية
- سياسة RLS التاريخية التي كانت تسمح لـ anon ببعض عمليات الوصول.
- **التصنيف:** `OBSOLETE_DECISION` (الحالة الحالية هي Default Deny).
- إجبار وصول الخادم (Server) فقط للمسارات الحساسة باستخدام `Service Role`.
- **التصنيف:** `IMPLEMENTATION_REPORT` / `APPROVED_DECISION`

## Cron
- استخدام cron-job.org بتردد 5 دقائق لضرب مسار `/api/send-queue`.
- مصادقة عبر رأس HTTP يحمل `CRON_SECRET`.
- **التصنيف:** `IMPLEMENTATION_REPORT` / `APPROVED_DECISION`

## البيئة المحلية والإنتاجية
- اقتراح استخدام ngrok لإتاحة Android SMS Gateway المحلي لخادم Vercel.
- **التصنيف:** `OBSOLETE_DECISION` (تُرك هذا الخيار بانتقال المشروع لـ kwtSMS).
- التطبيق يُرفع على Vercel و Supabase.
- **التصنيف:** `APPROVED_DECISION`

## الميزات التي كانت مقترحة ولم تُنفذ
- تصدير ملفات Excel للحجوزات (Excel Export).
- اقتراحات الأيام الذكية (Smart Intelligence) وتحليل الضغط.
- **التصنيف:** `PROPOSAL` / `UNKNOWN_EXECUTION_STATUS`

## القرارات التي تغيرت لاحقًا
- التذكير قبل 30 دقيقة تغير إلى 60 دقيقة.
- مزود Android Gateway تغير إلى kwtSMS.
- سياسات anon تم منعها تماماً بـ Default Deny.
