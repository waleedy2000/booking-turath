import { getSupabaseAdmin } from "@/utils/supabase-admin";

/**
 * دالة لمعالجة طابور الرسائل (SMS Queue) بشكل مباشر عبر السيرفر
 * يتم الاتصال بـ Gateway الخارجي لتنفيذ الإرسال وتحديث الحالة في قاعدة البيانات
 */
export async function processSmsQueue() {
  const supabase = getSupabaseAdmin();
  const gatewayUrl = process.env.SMS_GATEWAY_URL;

  if (!gatewayUrl) {
    console.warn("[SmsService] SMS Gateway not configured, skipping.");
    return { success: true, processed: 0, message: 'Gateway not configured' };
  }

  // جلب الرسائل التي لم يتم إرسالها بعد وحان وقت جدولتها
  const { data: messages, error } = await supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10); // دفعات صغيرة لتجنب البطء في الطلبات المتزامنة

  if (error) {
    console.error("[SmsService] Queue fetch error:", error);
    throw error;
  }

  if (!messages || messages.length === 0) {
    return { success: true, processed: 0, message: 'Queue is empty' };
  }

  const results = [];

  for (const msg of messages) {
    try {
      const res = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: msg.phone,
          message: msg.message,
        })
      });

      if (res.ok) {
        await supabase
          .from('message_queue')
          .update({ status: 'sent', attempts: msg.attempts + 1 })
          .eq('id', msg.id);
        
        results.push({ id: msg.id, status: 'sent' });
      } else {
        throw new Error(`Gateway returned status: ${res.status}`);
      }
    } catch (err) {
      console.error(`[SmsService] Failed to send SMS for msg ${msg.id}:`, err);
      
      const newAttempts = msg.attempts + 1;
      const newStatus = newAttempts >= 3 ? 'failed' : 'pending';

      try {
        await supabase
          .from('message_queue')
          .update({
            attempts: newAttempts,
            status: newStatus,
          })
          .eq('id', msg.id);
      } catch (updateErr) {
        console.error("[SmsService] DB Update Error during failure tracking:", updateErr);
      }
        
      results.push({ id: msg.id, status: newStatus });
    }

    // Rate Limiting لسيرفرات الـ SMS البسيطة
    if (messages.length > 1) {
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  return { success: true, processed: messages.length, results };
}
