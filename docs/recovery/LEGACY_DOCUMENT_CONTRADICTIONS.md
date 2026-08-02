# تناقضات التوثيق القديم (Legacy Document Contradictions)

## 1. التذكير الثابت قبل 30 دقيقة
- **Source file:** `SMS Gateway للمشاريع.txt` و `migration_roles.sql`
- **Section/Excerpt:** "إرسال رسالة تذكير قبل 30 دقيقة من الموعد" و `reminder_minutes int default 30`
- **Old statement:** التذكير يتم قبل 30 دقيقة.
- **Current replacement:** التذكير يتم قبل 60 دقيقة.
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_PRODUCTION_FACT`
- **Action:** `supersede`

## 2. مزود خدمة الـ SMS (Android SMS Gateway vs kwtSMS)
- **Source file:** `SMS Gateway للمشاريع.txt` و `PROJECT_MASTER.md`
- **Section/Excerpt:** "تطوير تطبيق Android بسيط كـ SMS Gateway"
- **Old statement:** الاعتماد على تطبيق جوال Android لإرسال رسائل المشروع عبر Firebase.
- **Current replacement:** Firebase/FCM كان للإشعارات Push. Android Gateway كان للرسائل SMS. kwtSMS أصبح مزود SMS الإنتاجي.
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_PRODUCTION_FACT`
- **Action:** `supersede`

## 3. بيئة الإنتاج والوصول الخارجي (ngrok)
- **Source file:** `PROJECT_MASTER.md`
- **Section/Excerpt:** مقترح ngrok.
- **Old statement:** ngrok كان لحماية لوحة الإدارة.
- **Current replacement:** ngrok كان مقترحًا لإتاحة Android SMS Gateway المحلي لخادم Vercel. التطبيق حاليا مستضاف ومتاح عبر Vercel للجميع.
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_PRODUCTION_FACT`
- **Action:** `supersede`

## 4. حالة نظام SMS للإنتاج (مؤجل / غير مفعل)
- **Source file:** `PROJECT_MASTER.md` (يفترض تأجيل الـ SMS الفعلي)
- **Section/Excerpt:** النقاش حول صعوبات توفير الميزانية وتأجيل الربط الفعلي.
- **Old statement:** الإنتاج لا يرسل SMS فعلياً أو يعتمد حلاً مؤقتاً.
- **Current replacement:** الـ SMS تعمل بشكل كامل وتم اختبارها من خلال مزود kwtSMS.
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_PRODUCTION_FACT`
- **Action:** `supersede`

## 5. حالة المرحلة C (Stage C)
- **Source file:** `NOTIFICATION_SYSTEM.md`
- **Section/Excerpt:** "Stage C" كجزء من خريطة الطريق التشغيلية الحالية.
- **Old statement:** البدء أو التخطيط لبدء المرحلة C (تعديل الحجوزات لمدراء الأقسام).
- **Current replacement:** عدم البدء بها الآن (DEFERRED_NOT_CANCELLED).
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_DECISION`
- **Action:** `supersede`

## 6. مسار التذكير المبكر (early_reminder)
- **Source file:** `NOTIFICATION_SYSTEM.md`
- **Section/Excerpt:** الإشارة لجدولة أحداث early_reminder.
- **Old statement:** وجود مرحلة تذكير مبكر قبل الموعد بمدة طويلة (كـ 24 ساعة).
- **Current replacement:** لا يوجد استدعاء أو استخدام لـ early_reminder في المسار التشغيلي الحالي (فقط confirmation و final_reminder).
- **Classification:** `OBSOLETE`
- **Evidence type:** `CODE_CONFIRMED`
- **Action:** `supersede`

## 7. سياسات الوصول (RLS Policies)
- **Source file:** `توثيق6.md` ومصادر أخرى قديمة
- **Section/Excerpt:** وصف سياسات تسمح بوصول مباشر لبعض الجداول.
- **Old statement:** التوثيق التاريخي وصف سياسات تسمح لـ anon ببعض عمليات القراءة أو الإدخال.
- **Current replacement:** RLS مفعّل، ولا توجد سياسات، والحالة Default Deny.
- **Classification:** `OBSOLETE`
- **Evidence type:** `OWNER_CONFIRMED_PRODUCTION_FACT`
- **Action:** `supersede`
