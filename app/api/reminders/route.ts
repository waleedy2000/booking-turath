import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabaseAdmin = getSupabaseAdmin();
import { dispatchEvent } from "@/lib/notification-dispatcher";

export const dynamic = 'force-dynamic';

export async function GET() {
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

    // 🎯 window ذكي + Atomic Update (يمنع الـ Race Conditions نهائياً)
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .update({ reminder_sent: true })
      .eq("date", todayStr)
      .eq("reminder_sent", false)
      .gte("start_time", currentTimeStr)
      .lte("start_time", futureTimeStr)
      .select("id, entity_id, date, start_time");

    if (error) throw error;

    for (const booking of bookings || []) {
      if (Date.now() - startTimeTracking > TIME_LIMIT) {
        console.warn("[Reminders API] TIME_LIMIT reached, breaking loop to avoid function timeout.");
        break;
      }
      
      await dispatchEvent({
        type: "BOOKING_REMINDER",
        entity_id: booking.entity_id,
        payload: { start_time: booking.start_time }
      });
    }

    return Response.json({
      success: true,
      processed: bookings?.length || 0,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
