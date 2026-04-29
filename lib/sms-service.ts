import { getSupabaseAdmin } from "@/utils/supabase-admin";

function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('965')) return '+' + trimmed;
  return '+' + trimmed;
}

/**
 * ✅ NEW: Enqueue SMS messages for a list of phone numbers.
 * Handles deduplication and scheduling.
 */
export async function enqueueSms(
  phones: string[],
  message: string,
  messageType: string,
  departmentId?: string,
  scheduledAt?: string
) {
  const supabase = getSupabaseAdmin();
  const scheduleTime = scheduledAt || new Date().toISOString();

  const queueItems: any[] = [];

  for (const phone of phones) {
    // Dedup check: same phone + same message + same type
    const { data: existing } = await supabase
      .from('message_queue')
      .select('id')
      .eq('phone', phone)
      .eq('message', message)
      .eq('message_type', messageType)
      .limit(1);

    if (!existing || existing.length === 0) {
      queueItems.push({
        phone,
        message,
        message_type: messageType,
        department_id: departmentId || null,
        status: 'pending',
        attempts: 0,
        scheduled_at: scheduleTime
      });
    }
  }

  if (queueItems.length > 0) {
    const { error } = await supabase.from('message_queue').insert(queueItems);
    if (error) {
      console.error("[SmsService] Failed to enqueue SMS:", error);
      throw error;
    }
  }

  return { queued: queueItems.length };
}

/**
 * دالة لمعالجة طابور الرسائل (SMS Queue) بشكل مباشر عبر السيرفر
 * يتم الاتصال بـ Gateway الخارجي لتنفيذ الإرسال وتحديث الحالة في قاعدة البيانات
 */
export async function processSmsQueue() {
  const supabase = getSupabaseAdmin();
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const login = process.env.SMS_GATEWAY_LOGIN;
  const password = process.env.SMS_GATEWAY_PASSWORD;

  if (!gatewayUrl) {
    console.warn("[SmsService] SMS Gateway not configured, skipping.");
    return { success: true, processed: 0, message: 'Gateway not configured' };
  }

  if ((login && !password) || (!login && password)) {
    console.error("[SmsService] Missing either SMS_GATEWAY_LOGIN or SMS_GATEWAY_PASSWORD. Authentication may fail.");
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (login && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
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
        headers: headers,
        body: JSON.stringify({
          message: msg.message,
          phoneNumbers: [normalizePhone(msg.phone)],
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
