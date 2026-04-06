import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department, pin, date, time } = body;

    // طباعة البيانات المستلمة للتأكد أثناء الاختبار (End-to-End)
    console.log("📥 Received booking payload:", { department, pin, date, time });

    // Validate inputs
    if (!department || !pin || !date || !time) {
      return NextResponse.json(
        { error: 'تفقد الحقول المطلوبة: اسم الجهة، رمز PIN، التاريخ، والوقت' },
        { status: 400 }
      );
    }

    // 1. تحقق من رمز الـ PIN الخاص بالجهة
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('pin_code')
      .eq('name', department)
      .single();

    if (deptError || !deptData) {
      return NextResponse.json({ error: 'الجهة غير مسجلة لدينا' }, { status: 404 });
    }

    if (deptData.pin_code !== pin) {
      return NextResponse.json({ error: 'رمز PIN غير صحيح لهذه الجهة' }, { status: 401 });
    }

    // 2. التحقق من التعارض (Overlap) لنفس اليوم والوقت
    const { data: existingBooking, error: checkError } = await supabase
      .from('bookings')
      .select('id')
      .eq('date', date)
      .eq('time', time)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking bookings:", checkError);
      return NextResponse.json({ error: 'حدث خطأ أثناء التحقق من المواعيد' }, { status: 500 });
    }

    if (existingBooking) {
      return NextResponse.json({ error: 'عذراً، هذا الوقت محجوز مسبقاً!' }, { status: 409 });
    }

    // 3. حفظ الحجز في قاعدة البيانات
    const { error: insertError } = await supabase
      .from('bookings')
      .insert([
        {
          department_name: department,
          date,
          time
        }
      ]);

    if (insertError) {
      console.error("Error inserting booking:", insertError);
      return NextResponse.json({ error: 'فشل في حفظ الحجز، حاول لاحقاً' }, { status: 500 });
    }

    // النجاح
    return NextResponse.json({ message: 'تم تأكيد الحجز بنجاح!' }, { status: 201 });

  } catch (error) {
    console.error("Booking handler error:", error);
    return NextResponse.json({ error: 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 });
  }

  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('time')
      .eq('date', date);

    if (error) {
      console.error("Error fetching bookings:", error);
      return NextResponse.json({ error: 'خطأ في جلب الحجوزات' }, { status: 500 });
    }

    const bookedTimes = bookings.map((b) => b.time);
    return NextResponse.json(bookedTimes, { status: 200 });
  } catch (error) {
    console.error("Booking GET error:", error);
    return NextResponse.json({ error: 'خطأ داخلي' }, { status: 500 });
  }
}
