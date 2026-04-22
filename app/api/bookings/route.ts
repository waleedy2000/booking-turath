import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { formatSingleTime } from '@/utils/timeFormat';
import { dispatchEvent } from '@/lib/notification-dispatcher';
import { processSmsQueue } from '@/lib/sms-service';

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin() as any;
  try {
    const body = await request.json();
    const { 
      department, 
      pin, 
      date, 
      start_time: st, 
      end_time: et, 
      start, 
      end 
    } = body;

    const start_time = st ?? start;
    const end_time = et ?? end;

    // طباعة البيانات المستلمة للتأكد أثناء الاختبار (End-to-End)
    console.log("📥 Received booking payload:", { department, pin, date, start_time, end_time });

    // Validate inputs
    if (!department || !pin || !date || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: 'تفقد الحقول المطلوبة: اسم الجهة، رمز PIN، التاريخ، ووقت البداية والنهاية' },
        { status: 400 }
      );
    }

    // 1. تحقق من رمز الـ PIN الخاص بالجهة
    const deptResult = await supabase
      .from('departments')
      .select('id, pin_code, phone')
      .eq('name', department)
      .single();

    const deptError = deptResult.error;
    const deptData = deptResult.data as any;

    if (deptError || !deptData) {
      return NextResponse.json({ error: 'الجهة غير مسجلة لدينا' }, { status: 404 });
    }

    if (deptData.pin_code !== pin) {
      return NextResponse.json({ error: 'رمز PIN غير صحيح لهذه الجهة' }, { status: 401 });
    }

    // 2. التحقق من التعارض (Overlap) لنفس اليوم والوقت بدقة الاحترافية
    const { data: existing, error: checkError } = await (supabase as any)
      .from('bookings')
      .select('*')
      .eq('date', date);

    if (checkError) {
      console.error("Error checking bookings:", checkError);
      return NextResponse.json({ error: 'حدث خطأ أثناء التحقق من المواعيد' }, { status: 500 });
    }

    const conflict = (existing as any[])?.some(b => 
      start_time < b.end_time && end_time > b.start_time
    );

    if (conflict) {
      return NextResponse.json({ success: false, message: 'هذا الوقت محجوز بالفعل' }, { status: 409 });
    }

    // 3. حفظ الحجز في قاعدة البيانات
    try {
      const { error: insertError } = await (supabase as any)
        .from('bookings')
        .insert([
          {
            department_name: department,
            date,
            start_time,
            end_time
          }
        ]);

      if (insertError) {
        console.error("Booking Insert Error:", insertError);
        return NextResponse.json({ success: false, message: 'فشل في حفظ الحجز' }, { status: 500 });
      }
    } catch (insertError) {
      console.error("Booking Insert Error:", insertError);
      return NextResponse.json({ success: false, message: 'فشل في حفظ الحجز' }, { status: 500 });
    }

    // --- Push Notification (Event Driven) ---
    try {
      await dispatchEvent({
        type: 'BOOKING_CREATED',
        entity_id: deptData.id,
      });
    } catch (pushErr) {
      console.error('Failed to dispatch push notification event:', pushErr);
    }

    // --- Notification Scheduling Logic ---
    const [y, m, d] = date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const formattedTime12hStart = formatSingleTime(start_time);
    const formattedTime12hEnd = formatSingleTime(end_time);
    
    try {
      // Fetch settings
      const { data: settings } = await supabase.from('settings').select('*').limit(1).single();
      const enable_confirmation = settings?.enable_confirmation ?? true;
      const enable_reminder = settings?.enable_reminder ?? true;
      const reminder_minutes = settings?.reminder_minutes ?? 30;

      const queueItems: any[] = [];
      const currentUtc = new Date().toISOString();

      // Confirmation Message (For Department)
      if (enable_confirmation && deptData.phone) {
        const confMsg = `📢 تأكيد حجز قاعة الاجتماعات\n\nتم تسجيل الحجز بنجاح:\n\n📍 الموقع: قاعة اجتماعات مبنى صباح الناصر\n📅 التاريخ: ${formattedDate}\n⏰ الوقت: ${formattedTime12hStart} – ${formattedTime12hEnd}\n🏢 الجهة: ${department}\n\nنرجو الالتزام بالموعد المحدد.`;
        
        // Prevent duplicate string
        const { data: existingConf } = await supabase
          .from('message_queue')
          .select('id')
          .eq('phone', deptData.phone)
          .eq('message', confMsg)
          .eq('message_type', 'confirmation')
          .limit(1);

        if (!existingConf || existingConf.length === 0) {
          queueItems.push({
            phone: deptData.phone,
            message: confMsg,
            message_type: 'confirmation',
            status: 'pending',
            attempts: 0,
            scheduled_at: currentUtc
          });
        }
      }

      // Reminder Message (For Subscribers)
      if (enable_reminder) {
        // Calculate reminder time (Kuwait UTC+3 -> UTC)
        const [hourStr, minStr] = start_time.split(':');
        const h = parseInt(hourStr, 10);
        const min = parseInt(minStr || "0", 10);
        
        // Construct Kuwiat time ISO string properly
        const localDate = new Date(`${date}T${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00+03:00`);
        const reminderTime = new Date(localDate.getTime() - reminder_minutes * 60000);
        const reminderUtc = reminderTime.toISOString();

        const reminderMsg = `⏰ تذكير بموعد اجتماع\n\nلديك اجتماع بعد ${reminder_minutes} دقيقة:\n\n📍 قاعة اجتماعات مبنى صباح الناصر\n📅 اليوم: ${formattedDate}\n⏰ الوقت: ${formattedTime12hStart}\n\nيرجى الحضور في الوقت المحدد.`;

        const { data: subs } = await supabase.from('subscribers').select('phone');
        
        if (subs && subs.length > 0) {
          for (const sub of subs) {
            const { data: existingRem } = await supabase
              .from('message_queue')
              .select('id')
              .eq('phone', sub.phone)
              .eq('message', reminderMsg)
              .eq('message_type', 'reminder')
              .limit(1);

            if (!existingRem || existingRem.length === 0) {
              queueItems.push({
                phone: sub.phone,
                message: reminderMsg,
                message_type: 'reminder',
                status: 'pending',
                attempts: 0,
                scheduled_at: reminderUtc
              });
            }
          }
        }
      }

      // Bulk insert messages
      if (queueItems.length > 0) {
        const { error: queueErr } = await supabase.from('message_queue').insert(queueItems);
        if (queueErr) console.error("Failed to insert queue items:", queueErr);
      }

      // Trigger worker asynchronously to flush out immediate confirmations
      // We do NOT use fetch to internal API routes to avoid "fetch failed" errors.
      // We call the service directly but do not await it to keep the response fast.
      processSmsQueue().catch(err => console.error("[ApiBookings] Background queue processing failed:", err));

    } catch (err) {
      console.error('Failed to schedule SMS:', err);
    }

    // النجاح
    return NextResponse.json({ message: 'تم تأكيد الحجز بنجاح!' }, { status: 201 });

  } catch (error) {
    console.error("Booking handler error:", error);
    return NextResponse.json({ error: 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const month = searchParams.get('month');

    // Debug logging for GET request params
    console.log(`[ApiBookings GET] Incoming request: date=${date}, month=${month}`);

    let query = supabase.from('bookings').select('*');

    if (date) {
      console.log(`[ApiBookings GET] Applying date filter: ${date}`);
      query = query.eq('date', date);
    } else if (month) {
      console.log(`[ApiBookings GET] Applying month filter: ${month}`);
      try {
        const [year, monthNum] = month.split('-');
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        query = query.gte('date', `${month}-01`).lte('date', `${month}-${lastDay}`);
      } catch (dateErr) {
        console.warn(`[ApiBookings GET] Date parsing failed for month: ${month}`, dateErr);
        query = query.gte('date', `${month}-01`).lte('date', `${month}-31`);
      }
    } else {
      console.log(`[ApiBookings GET] No filters provided, fetching all.`);
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error("[ApiBookings GET] Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[ApiBookings GET] Success: Returned ${data?.length || 0} rows.`);
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("[ApiBookings GET] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })
    }

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
