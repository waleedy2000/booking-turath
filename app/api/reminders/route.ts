import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabaseAdmin = getSupabaseAdmin();
import { dispatchEvent } from "@/lib/notification-dispatcher";
import { formatTo12Hour } from "@/utils/timeFormat";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[Reminders API] Unauthorized access attempt");
    return new Response('Unauthorized', { status: 401 });
  }

  console.log("[Reminders API] Reminders cron started");

  try {
    const startTimeTracking = Date.now();
    const TIME_LIMIT = 8000; // 8 seconds timeout wrapper for Vercel
    const now = new Date();
    
    // Convert to Kuwait/Saudi time (+3 hours) since that's what the bookings use
    const saudiNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    
    const todayStr = saudiNow.toISOString().split('T')[0];
    const currentHour = saudiNow.getUTCHours().toString().padStart(2, '0');
    const currentMin = saudiNow.getUTCMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("reminder_minutes")
      .limit(1)
      .single();

    const minutes = settings?.reminder_minutes || 30;
    
    // Future window
    const saudiFuture = new Date(saudiNow.getTime() + minutes * 60000);
    const futureHour = saudiFuture.getUTCHours().toString().padStart(2, '0');
    const futureMin = saudiFuture.getUTCMinutes().toString().padStart(2, '0');
    const futureTimeStr = `${futureHour}:${futureMin}`;

    console.log(`[Reminders API] Checking bookings for ${todayStr} between ${currentTimeStr} and ${futureTimeStr}`);

    // 🎯 Atomic Update: mark as sent + fetch in one query (prevents race conditions)
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .update({ reminder_sent: true })
      .eq("date", todayStr)
      .eq("reminder_sent", false)
      .gte("start_time", currentTimeStr)
      .lte("start_time", futureTimeStr)
      .select("id, department_id, department_name, date, start_time");

    if (error) {
      console.error("[Reminders API] Database error:", error);
      throw error;
    }

    const foundCount = bookings?.length || 0;
    console.log(`[Reminders API] Found ${foundCount} bookings to remind`);

    let sentCount = 0;
    for (const booking of bookings || []) {
      if (Date.now() - startTimeTracking > TIME_LIMIT) {
        console.warn("[Reminders API] TIME_LIMIT reached, breaking loop.");
        break;
      }

      // Resolve department_id: use direct field or lookup from department_name
      let deptId = booking.department_id;
      let deptName = booking.department_name;

      if (!deptId && deptName) {
        const { data: dept } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("name", deptName)
          .single();
        deptId = dept?.id;
      }

      if (!deptId) {
        console.warn(`[Reminders API] Skipping booking ${booking.id}: No department_id found`);
        continue;
      }

      // Format date for messages
      const [y, m, d] = booking.date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      const formattedStart = booking.start_time ? (() => { const f = formatTo12Hour(booking.start_time); return `${f.time} ${f.period}`; })() : '';

      try {
        await dispatchEvent({
          type: "BOOKING_REMINDER",
          department_id: deptId,
          department_name: deptName,
          payload: {
            start_time: booking.start_time,
            formatted_date: formattedDate,
            formatted_start: formattedStart,
            reminder_minutes: minutes,
          }
        });
        sentCount++;
      } catch (dispatchErr) {
        console.error(`[Reminders API] Failed to dispatch reminder for booking ${booking.id}:`, dispatchErr);
      }
    }

    console.log(`[Reminders API] Reminders cron finished. Processed: ${sentCount}/${foundCount}`);

    return NextResponse.json({
      success: true,
      found: foundCount,
      processed: sentCount,
    });
  } catch (err: any) {
    console.error("[Reminders API] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
