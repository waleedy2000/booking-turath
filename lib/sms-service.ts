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

  const queueItems: Array<{
    phone: string;
    message: string;
    message_type: string;
    department_id: string | null;
    status: 'pending';
    attempts: number;
    scheduled_at: string;
  }> = [];

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

  let insertedIds: string[] = [];

  if (queueItems.length > 0) {
    const { data, error } = await supabase
      .from('message_queue')
      .insert(queueItems)
      .select('id');
    if (error) {
      console.error("[SmsService] Failed to enqueue SMS:", error);
      throw error;
    }
    insertedIds = data?.map((item: { id: string }) => item.id) || [];
  }

  return { queued: queueItems.length, ids: insertedIds };
}

/**
 * دالة لمعالجة طابور الرسائل (SMS Queue) بشكل مباشر عبر السيرفر
 * يتم الاتصال بـ Gateway الخارجي لتنفيذ الإرسال وتحديث الحالة في قاعدة البيانات
 */
export async function processSmsQueue(options: { ids?: string[] } = {}) {
  const supabase = getSupabaseAdmin();
  const provider = process.env.SMS_PROVIDER || 'android_gateway';

  // Android Gateway config
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const login = process.env.SMS_GATEWAY_LOGIN;
  const password = process.env.SMS_GATEWAY_PASSWORD;

  // KWTSMS config
  const kwtsmsUrl = process.env.KWTSMS_API_URL || 'https://www.kwtsms.com/API/send/';
  const kwtsmsUsername = process.env.KWTSMS_USERNAME;
  const kwtsmsPassword = process.env.KWTSMS_PASSWORD;
  const kwtsmsSender = process.env.KWTSMS_SENDER;
  const kwtsmsTestMode = process.env.KWTSMS_TEST_MODE || '0';

  if (provider === 'android_gateway' && !gatewayUrl) {
    console.warn("[SmsService] SMS Gateway not configured, skipping.");
    return { success: true, processed: 0, message: 'Gateway not configured' };
  }

  if (provider === 'kwtsms' && (!kwtsmsUsername || !kwtsmsPassword || !kwtsmsSender)) {
    console.warn("[SmsService] kwtSMS not configured properly, skipping.");
    return { success: true, processed: 0, message: 'kwtSMS not configured' };
  }

  if (provider === 'android_gateway' && ((login && !password) || (!login && password))) {
    console.error("[SmsService] Missing either SMS_GATEWAY_LOGIN or SMS_GATEWAY_PASSWORD. Authentication may fail.");
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (provider === 'android_gateway' && login && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
  } else if (provider === 'kwtsms') {
    headers['Accept'] = 'application/json';
  }

  // جلب الرسائل التي لم يتم إرسالها بعد وحان وقت جدولتها
  let query = supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10); // دفعات صغيرة لتجنب البطء في الطلبات المتزامنة

  if (options.ids?.length) {
    query = query.in('id', options.ids);
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error("[SmsService] Queue fetch error:", error);
    throw error;
  }

  if (!messages || messages.length === 0) {
    return { success: true, processed: 0, message: 'Queue is empty' };
  }

  const results = [];
  const now = Date.now();

  for (const msg of messages) {
    // Expiry check for reminders (older than 60 minutes)
    if (msg.message_type === 'reminder' && msg.scheduled_at) {
      const scheduledTime = new Date(msg.scheduled_at).getTime();
      const diffMinutes = (now - scheduledTime) / (1000 * 60);
      
      if (diffMinutes > 60) {
        console.warn(`[SmsService] Expired stale reminder msg ${msg.id}`);
        
        const { error: updateError } = await supabase
          .from('message_queue')
          .update({ status: 'expired' })
          .eq('id', msg.id);
          
        if (updateError) {
          console.warn(`[SmsService] DB constraint rejected 'expired' status, falling back to 'failed' for msg ${msg.id}`);
          await supabase
            .from('message_queue')
            .update({ status: 'failed', error: 'expired_reminder' })
            .eq('id', msg.id);
        }
        
        results.push({ id: msg.id, status: updateError ? 'failed' : 'expired' });
        continue;
      }
    }

    try {
      let isSuccess = false;

      if (provider === 'kwtsms') {
        const normalizedPhone = normalizePhone(msg.phone);
        const mobile = normalizedPhone.startsWith('+') ? normalizedPhone.substring(1) : normalizedPhone;

        const res = await fetch(kwtsmsUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            username: kwtsmsUsername,
            password: kwtsmsPassword,
            sender: kwtsmsSender,
            mobile: mobile,
            message: msg.message,
            test: kwtsmsTestMode
          })
        });

        if (!res.ok) {
          throw new Error(`kwtSMS HTTP error: ${res.status}`);
        }

        const data = await res.json();
        if (data.result === 'OK') {
          isSuccess = true;
          console.log(`[SmsService] kwtSMS success for msg ${msg.id}: msgId=${data['msg-id'] || 'N/A'}, balance=${data['balance-after'] || 'N/A'}`);
        } else {
          console.error(`[SmsService] kwtSMS API error for msg ${msg.id}: code=${data.code || 'N/A'}, description=${data.description || JSON.stringify(data)}`);
          throw new Error(`kwtSMS API returned: ${data.result}`);
        }
      } else {
        const res = await fetch(gatewayUrl as string, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            message: msg.message,
            phoneNumbers: [normalizePhone(msg.phone)],
          })
        });

        if (res.ok) {
          isSuccess = true;
        } else {
          throw new Error(`Gateway returned status: ${res.status}`);
        }
      }

      if (isSuccess) {
        await supabase
          .from('message_queue')
          .update({ status: 'sent', attempts: msg.attempts + 1 })
          .eq('id', msg.id);
        
        results.push({ id: msg.id, status: 'sent' });
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
