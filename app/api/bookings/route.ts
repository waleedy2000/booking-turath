import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { formatTo12Hour } from '@/utils/timeFormat';
import { dispatchEvent } from '@/lib/notification-dispatcher';
import { createBookingNotificationEvents, processDueNotificationEvents, rescheduleFinalReminders } from '@/lib/booking-notification-events';
import { normalizeKuwaitiPhone, maskPhone } from '@/lib/phone-utils';
import { requireAdmin } from '@/lib/admin-auth';
import { validateBookingRules } from '@/services/timeSlotsEngine';

export function isActiveBookingForConflict(booking: any) {
  return booking.status === null || booking.status !== 'cancelled';
}

function timeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

type InsertedBooking = {
  id: string;
  department_id: string;
  department_name: string;
  date: string;
  start_time: string;
  end_time: string;
};

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

    // طباعة البيانات المستلمة للتأكد أثناء الاختبار (End-to-End) - تمت إزالتها لأسباب أمنية

    // Validate inputs
    if (!department || !pin || !date || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: 'تفقد الحقول المطلوبة: اسم الجهة، رمز PIN، التاريخ، ووقت البداية والنهاية' },
        { status: 400 }
      );
    }

    // 1. تحقق من صحة المواعيد
    const validation = validateBookingRules(date, start_time, end_time);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 }
      );
    }

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
    const { data: allExisting, error: checkError } = await (supabase as any)
      .from('bookings')
      .select('*')
      .eq('date', date);

    if (checkError) {
      console.error("Error checking bookings:", checkError.message);
      return NextResponse.json({ error: 'حدث خطأ أثناء التحقق من المواعيد' }, { status: 500 });
    }

    const activeExisting = (allExisting as any[])?.filter(isActiveBookingForConflict) || [];
    const conflict = activeExisting.some(b =>
      start_time < b.end_time && end_time > b.start_time
    );

    if (conflict) {
      return NextResponse.json({ success: false, message: 'هذا الوقت محجوز بالفعل' }, { status: 409 });
    }

    // 3. حفظ الحجز في قاعدة البيانات (with department_id)
    let bookingData: InsertedBooking | null = null;
    try {
      const { data: insertedBooking, error: insertError } = await (supabase as any)
        .from('bookings')
        .insert([
          {
            department_name: department,
            department_id: deptData.id,
            date,
            start_time,
            end_time
          }
        ])
        .select('id, department_id, department_name, date, start_time, end_time')
        .single();

      if (insertError) {
        console.error("Booking Insert Error:", insertError.message);
        if (insertError.code === '23505') {
          return NextResponse.json({ success: false, message: 'هذا الوقت محجوز بالفعل' }, { status: 409 });
        }
        return NextResponse.json({ success: false, message: 'فشل في حفظ الحجز' }, { status: 500 });
      }
      bookingData = insertedBooking;
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
    let contactPhone = normalizeKuwaitiPhone(deptData.booking_contact_phone);
    if (!contactPhone && deptData.booking_contact_phone) {
      console.warn(`[API Bookings] Invalid booking_contact_phone (${maskPhone(deptData.booking_contact_phone)}) for department ${deptData.id}. Trying fallback.`);
    }

    if (!contactPhone) {
      contactPhone = normalizeKuwaitiPhone(deptData.phone);
      if (!contactPhone && deptData.phone) {
        console.warn(`[API Bookings] Invalid fallback phone (${maskPhone(deptData.phone)}) for department ${deptData.id}.`);
      }
    }

    // 5. Dispatch unified notification event (handles both SMS + Push)
    try {
      if (bookingData?.id) {
        await createBookingNotificationEvents({
          id: bookingData.id,
          department_id: deptData.id,
          department_name: department,
          date,
          start_time,
          end_time,
        });

        await processDueNotificationEvents({
          bookingId: bookingData.id,
          stage: 'confirmation',
          limit: 50,
        });
      }

      await dispatchEvent({
        type: 'BOOKING_CREATED',
        department_id: deptData.id,
        department_name: department,
        booking_contact_phone: contactPhone || undefined,
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
      console.error("[ApiBookings GET] Supabase Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeData = (data ?? []).filter(isActiveBookingForConflict);
    console.log(`[ApiBookings GET] Success: Returned ${activeData.length} active rows (out of ${data?.length || 0} total).`);
    return NextResponse.json(activeData);
  } catch (err: any) {
    console.error("[ApiBookings GET] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 })
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'فشل الإلغاء' }, { status: 500 })
    }

    // Cancel any future notification events
    await supabase
      .from('booking_notification_events')
      .update({ status: 'skipped' })
      .eq('booking_id', id)
      .eq('status', 'pending');

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  try {
    const body = await request.json();
    const { id, date, start_time, end_time } = body;

    if (!id || !date || !start_time || !end_time) {
      return NextResponse.json({ success: false, message: 'معلومات غير مكتملة' }, { status: 400 });
    }

    const validation = validateBookingRules(date, start_time, end_time);
    if (!validation.valid) {
      return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
    }

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ success: false, message: 'الحجز غير موجود' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: false, message: 'لا يمكن تعديل حجز ملغى' }, { status: 400 });
    }

    // Check conflict
    const { data: allExisting, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', date)
      .neq('id', id);

    if (checkError) {
      return NextResponse.json({ success: false, message: 'حدث خطأ أثناء التحقق من المواعيد' }, { status: 500 });
    }

    const activeExisting = (allExisting as any[])?.filter(isActiveBookingForConflict) || [];
    const conflict = activeExisting.some((b: any) =>
      start_time < b.end_time && end_time > b.start_time
    );

    if (conflict) {
      return NextResponse.json({ success: false, message: 'هذا الوقت محجوز بالفعل' }, { status: 409 });
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        date,
        start_time,
        end_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ success: false, message: 'فشل تعديل الحجز' }, { status: 500 });
    }

    // Handle notifications safely without sending edit SMS
    try {
       await rescheduleFinalReminders({
          id: booking.id,
          department_id: booking.department_id,
          department_name: booking.department_name,
          date,
          start_time,
          end_time,
       });
    } catch (evtErr: any) {
       console.error('Failed to reschedule final reminders:', evtErr);
       return NextResponse.json({ success: false, message: 'تم تعديل الحجز ولكن فشلت إعادة جدولة التذكير' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'تم تعديل الحجز بنجاح' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Internal server error' }, { status: 500 });
  }
}
