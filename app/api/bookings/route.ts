import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { formatTo12Hour } from '@/utils/timeFormat';
import { dispatchEvent } from '@/lib/notification-dispatcher';

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
      .select('id, pin_code, phone, booking_contact_phone')
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

    // 3. حفظ الحجز في قاعدة البيانات (with department_id)
    try {
      const { error: insertError } = await (supabase as any)
        .from('bookings')
        .insert([
          {
            department_name: department,
            department_id: deptData.id,
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

    // 4. Format time strings for notifications
    const [y, m, d] = date.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const startFmt = formatTo12Hour(start_time);
    const endFmt = formatTo12Hour(end_time);
    const formattedStart = `${startFmt.time} ${startFmt.period}`;
    const formattedEnd = `${endFmt.time} ${endFmt.period}`;

    // Resolve contact phone: new field first, fallback to legacy
    const contactPhone = deptData.booking_contact_phone || deptData.phone || null;

    // 5. Dispatch unified notification event (handles both SMS + Push)
    try {
      await dispatchEvent({
        type: 'BOOKING_CREATED',
        department_id: deptData.id,
        department_name: department,
        booking_contact_phone: contactPhone,
        payload: {
          date,
          start_time,
          end_time,
          formatted_date: formattedDate,
          formatted_start: formattedStart,
          formatted_end: formattedEnd,
        },
      });
    } catch (notifyErr) {
      console.error('Failed to dispatch notification event:', notifyErr);
      // Don't fail the booking if notifications fail
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
