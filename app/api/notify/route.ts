import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department, date, time } = body;

    const message = `📢 تم حجز قاعة\n\n📅 ${date}\n⏰ ${time}\n👥 ${department}`;

    // Get all subscribers
    const { data: subscribers, error } = await supabase.from('subscribers').select('*');
    
    if (error || !subscribers) {
      return NextResponse.json({ error: 'فشل جلب المشتركين' }, { status: 500 });
    }

    const queueItems = subscribers.map((user: { phone: string }) => ({
      phone: user.phone,
      message,
      status: 'pending',
      attempts: 0
    }));

    if (queueItems.length > 0) {
      const { error: insertError } = await supabase.from('message_queue').insert(queueItems);
      if (insertError) {
        console.error("Failed to enqueue messages:", insertError);
        return NextResponse.json({ error: "فشل إضافة الرسائل للطابور" }, { status: 500 });
      }
    }

    // Call the worker asynchronously to process the queue immediately
    fetch(new URL('/api/send-queue', request.url), { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    }).catch(err => {
      console.error("Error triggering send-queue from notify:", err);
    });

    return NextResponse.json({ success: true, queued: queueItems.length });
  } catch (err) {
    console.error("Notify API Error:", err);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}
