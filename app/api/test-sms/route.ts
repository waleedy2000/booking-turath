import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { processSmsQueue } from "@/lib/sms-service";
const supabase = getSupabaseAdmin();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, type } = body;

    if (!phone) return NextResponse.json({ error: 'Phone is required' }, { status: 400 });

    let msg = `رسالة تجريبية (${type})\nالتاريخ: ${new Date().toLocaleString()}`;
    
    if (type === 'confirmation') {
      msg = `📢 تأكيد حجز قاعة الاجتماعات (تجربة)\n\nتم تسجيل الحجز بنجاح:\n\n📍 الموقع: قاعة اجتماعات مبنى صباح الناصر\n📅 التاريخ: 09/04/2026\n⏰ الوقت: 04:00 م – 06:00 م\n🏢 الجهة: الكلمة الطيبة\n\nنرجو الالتزام بالموعد المحدد.`;
    } else if (type === 'reminder') {
      msg = `⏰ تذكير بموعد اجتماع (تجربة)\n\nلديك اجتماع بعد 30 دقيقة:\n\n📍 قاعة اجتماعات مبنى صباح الناصر\n📅 اليوم: 09/04/2026\n⏰ الوقت: 04:00 م\n\nيرجى الحضور في الوقت المحدد.`;
    }

    const { error } = await supabase.from('message_queue').insert([{
      phone,
      message: msg,
      message_type: type || 'test',
      status: 'pending',
      attempts: 0,
      scheduled_at: new Date().toISOString()
    }]);

    if (error) throw error;

    const result = await processSmsQueue();
    let sentCount = 0;
    let failedCount = 0;
    
    if (result.results) {
      sentCount = result.results.filter((r: any) => r.status === 'sent').length;
      failedCount = result.results.filter((r: any) => r.status !== 'sent').length;
    }

    return NextResponse.json({ 
      success: true,
      processed: result.processed,
      sent: sentCount,
      failed: failedCount,
      message: result.message || 'تمت معالجة الطابور'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
