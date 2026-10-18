# القرارات والتاريخ (Decisions and History)

يُلخص هذا المستند أبرز القرارات التقنية والتشغيلية المعتمدة والتغييرات التاريخية عبر الالتزامات الرئيسية (Commits).

## جدول القرارات الأساسية

| القرار | الحالة | الدليل | البديل القديم (إن وجد) |
|---|---|---|---|
| اعتماد kwtSMS للإنتاج | `APPROVED_DECISION` | `OWNER_CONFIRMED_PRODUCTION_FACT` | تطبيق جوال Android SMS Gateway. |
| التذكير النهائي قبل 60 دقيقة | `APPROVED_DECISION` | `OWNER_CONFIRMED_PRODUCTION_FACT` | التذكير قبل 30 دقيقة. |
| تقصير SMS وتفصيل Push | `APPROVED_DECISION` | `OWNER_CONFIRMED_DECISION` | لا يوجد (رسائل موحدة سابقاً). |
| اعتماد الإلغاء المرن (Soft Cancel) | `APPROVED_DECISION` | الالتزام: `874cef4` | الحذف النهائي أو إبقاء الحجز متعارضاً. |
| إعادة استخدام الفترات الملغاة | `APPROVED_DECISION` | الفهرس `unique_active_booking_slot` والالتزام `874cef4` | الفهرس القديم `unique_booking_slot`. |
| إعادة استخدام صف `final_reminder` (Upsert) | `APPROVED_DECISION` | الالتزام: `65cc4da` | حذف وإنشاء حدث تنبيه جديد. |
| حماية مسارات الأدمن بـ JWT | `APPROVED_DECISION` | الالتزام: `69361dc` | وصول الشبكة المحلية المباشر. |
| الرفض الافتراضي (Default Deny) لـ RLS | `APPROVED_DECISION` | `OWNER_CONFIRMED_PRODUCTION_FACT` | وصول `anon` المباشر ببعض سياسات القراءة/الكتابة. |
| اعتماد مدعوين إضافيين على مستوى الحجز (`BOOKING_INVITEES_V1`) | `IMPLEMENTED_AND_VERIFIED` | الالتزام: `4e048ff` و `OWNER_CONFIRMED_PRODUCTION_FACT` | إضافتهم كأعضاء في الجهة أو إنشاء محرك إشعارات جديد. |
| تخصيص إشعارات المدعوين (SMS فقط ودون Push) | `APPROVED_DECISION` | `OWNER_CONFIRMED_PRODUCTION_FACT` | شمول المدعوين في إشعارات Push. |
| اعتماد Asia/Kuwait كسلطة زمنية لحساب اليوم وحظر الأوقات الماضية (`DEFAULT_KUWAIT_DATE_AND_PAST_SLOTS`) | `IMPLEMENTED_AND_PRODUCTION_VERIFIED` | الالتزام: `a51768a` و `OWNER_CONFIRMED_PRODUCTION_FACT` | الاعتماد على تاريخ UTC أو التوقيت المحلي لمتصفح المستخدم. |
| تحصين واجهة إدارة المشاركين وفحص `response.ok` لمنع النجاح الوهمي (`PARTICIPANTS_ADMIN_HARDENING`) | `IMPLEMENTED_AND_PRODUCTION_VERIFIED` | الالتزام: `44fe5dc` | افتراض نجاح Fetch دون فحص `res.ok` (False Success عند كود 400/500). |
| التقييس الخادمي لهواتف المشاركين (`normalizeKuwaitiPhone`) ومنع التكرار المجمع | `APPROVED_DECISION` | الالتزام: `44fe5dc` | الاعتماد على تدقيق العميل فقط (Client-side validation). |
| اعتماد نمط "جهة النظام الخاصة" للاجتماع الطارئ (`Special System Department`) | `IMPLEMENTED_AND_VERIFIED` | الالتزام: `8a66985` | إضافة عمود أصيل `booking_type` يستلزم تعديل Schema قاعدة البيانات. |
| إعادة استخدام جدول `booking_invitees` لمشاركي الطوارئ | `APPROVED_DECISION` | الالتزام: `8a66985` | إنشاء جدول مستقل ومكرر باسم `emergency_participants`. |
| احتواء مخاطرة الكيان السحري عبر ثابت مركزي واحد (`EMERGENCY_DEPARTMENT_NAME`) | `APPROVED_DECISION` | الالتزام: `8a66985` (`lib/booking-constants.ts`) | تكرار النصوص الحرفية لاسم جهة النظام في عدة ملفات. |
| إغلاق ميزة الاجتماع الطارئ بعد اكتمال كافة الفحوصات التشغيلية (`EMERGENCY_MEETING_V1`) | `COMPLETED_AND_PRODUCTION_VERIFIED` | الالتزامات: `8a66985` وما تلاها | بقاء اختبارات إعادة الجدولة والإلغاء معلقة. |
| اعتماد الخدمة الذاتية لمسؤولي الحجز دون جلسات أو JWT مع توحيد منطق العمليات (`BOOKING_OWNER_SELF_SERVICE_V1`) | `COMPLETED_AND_PRODUCTION_VERIFIED` | الالتزامات: `239accf` إلى `882810a` | بناء نظام جلسات أو حسابات مستخدمين كاملة أو فتح مسارات الأدمن للعامة. |
| توحيد منطق تعديل وإلغاء الحجز للأدمن والمالك عبر `bookingOperationsService` | `APPROVED_DECISION` | الالتزام: `239accf` | تكرار منطق فحص التعارضات والـ Soft Cancel بين الأدمن والواجهة العامة. |
| سجل تدقيق العمليات الخادمي (`booking_activity_log`) خالٍ من PII وبلا Backfill | `APPROVED_DECISION` | الالتزام: `239accf` | تسجيل أرقام الهواتف أو محاولة تعبئة العمليات التاريخية السابقة. |
| اعتماد cron-job.org كل 5 دقائق للمهام المجدولة وحمايتها بـ `CRON_SECRET` | `APPROVED_DECISION` | `OWNER_CONFIRMED_PRODUCTION_FACT` | الاعتماد على مشغلات محلية أو Vercel Cron. |
| تأجيل المرحلة الثالثة (Stage C) | `DEFERRED_NOT_CANCELLED` | `OWNER_CONFIRMED_DECISION` | التخطيط للبدء الفوري بها أو اعتبار الخدمة الذاتية بديلاً عنها. |

## الالتزامات الرئيسية والمرجعية
تُشكل هذه الالتزامات الأساس التشغيلي وتؤكد تطبيق القرارات المذكورة أعلاه:
- `882810a`: تحسين تباين زر تأكيد الإلغاء في نافذة الخدمة الذاتية.
- `3a3d2ff`: توحيد لغة تصميم الأوقات والتغذية الراجعة بعد تعديل الموعد.
- `8707d8a`: توحيد ألوان أزرار الخدمة الذاتية مع الهوية الخضراء.
- `7326e6c`: منع انهيار React Hooks عند فتح نافذة إدارة الحجز.
- `239accf`: إضافة ميزة الخدمة الذاتية لمسؤولي الحجز وسجل تدقيق النشاط والخدمة المشتركة.
- `8a66985`: إضافة ميزة ونمط حجز الاجتماع الطارئ وتثبيت الثابت المركزي.
- `44fe5dc`: تحصين إدارة المشاركين باللوحة والتأكد من استجابة الخادم وتقييس الهواتف.
- `a51768a`: اعتماد توقيت الكويت كسلطة زمنية وحظر الأوقات والتواريخ الماضية.
- `4e048ff`: إضافة ميزة المدعوين الإضافيين التابعين للحجز وتنبيهات SMS.
- `69361dc`: حماية الأدمن وفرض قواعد الحجز والمصادقة.
- `2916b0c`: تقصير رسائل SMS إلى رسالة واحدة (تجنب شرائح متعددة).
- `65cc4da`: إصلاح إعادة جدولة التذكيرات النهائية بعد تعديلات الحجوزات.
- `874cef4`: إصلاح والسماح بإعادة الحجز للفترات الملغاة (عبر الفهرس الجزئي وإعادة الصياغة المنطقية).
- `656a634`: اعتماد وحفظ خط أساس الاستعادة (Recovery Baseline).
