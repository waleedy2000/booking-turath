import * as admin from "firebase-admin";
import { supabaseAdmin as supabase } from "@/utils/supabase-admin";

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountStr) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is missing in environment variables.");
    }
    const serviceAccount = JSON.parse(serviceAccountStr);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

/**
 * Smart Retry Wrapper for external network calls (e.g. Firebase)
 */
async function sendWithRetry(fn: () => Promise<any>, retries = 3): Promise<any> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, 500));
    return sendWithRetry(fn, retries - 1);
  }
}

/**
 * دالة Service نقية تقوم بإرسال الإشعار لجهة معينة مع ضمان الحماية وتقسيم الدفعات، دون الحاجة للاتصال بـ HTTP APIs.
 */
export async function sendToEntityDirect(entity_id: string, title: string, body: string, type: string = "booking") {
  // 1) Idempotency Check (Prevent duplicate triggers within 10 seconds)
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const { data: recentLogs } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('entity_id', entity_id)
    .eq('title', title)
    .gte('created_at', tenSecondsAgo)
    .limit(1);

  if (recentLogs && recentLogs.length > 0) {
    console.log('[NotificationService] Idempotency block: Duplicate notification throttled (within 10s).');
    return { success: true, message: 'Notification throttled (idempotency)', sent: 0, failed: 0 };
  }

  // 2) Fetch tokens for targeted entity
  const { data: tokensData, error: dbError } = await supabase
    .from('push_tokens')
    .select('token, users!inner(entity_id)')
    .eq('users.entity_id', entity_id);

  if (dbError) {
    console.error("[NotificationService] Database error fetching tokens:", dbError);
    return { success: false, error: "Failed to fetch tokens" };
  }

  const tokens = tokensData?.map((t: any) => t.token) || [];

  if (!tokens.length) {
    return { success: true, message: 'No registered tokens found', sent: 0, failed: 0 };
  }

  // 3) Push notification using Multicast (Batches of 500)
  let totalSent = 0;
  let totalFailed = 0;
  const failedTokens: string[] = [];
  const chunkSize = 500;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const tokensChunk = tokens.slice(i, i + chunkSize);

    const message = {
      tokens: tokensChunk,
      notification: { title, body },
      data: { title, body },
      webpush: {
        notification: { title, body }
      }
    };

    const response = await sendWithRetry(() => 
      admin.messaging().sendEachForMulticast(message)
    );
    
    totalSent += response.successCount;
    totalFailed += response.failureCount;

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const error = res.error;
        if (
          error?.code === 'messaging/registration-token-not-registered' || 
          error?.code === 'messaging/invalid-registration-token'
        ) {
          failedTokens.push(tokensChunk[idx]);
        }
      }
    });

    // Rate Limiting / Quota Protection: Delay next chunk
    if (i + chunkSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // 4) Remove unregistered tokens from Supabase (Chunked for URL length limits)
  if (failedTokens.length > 0) {
    for (let i = 0; i < failedTokens.length; i += 200) {
      await supabase
        .from('push_tokens')
        .delete()
        .in('token', failedTokens.slice(i, i + 200));
    }
  }

  // 5) Log the notification with failure tracking
  const status = totalFailed > 0 ? (totalSent > 0 ? 'partial_failure' : 'failed') : 'sent';
  const errorReason = totalFailed > 0 ? `Failed tokens: ${totalFailed}` : null;

  await supabase
    .from('notification_logs')
    .insert({
      entity_id,
      title,
      body,
      status,
      error: errorReason,
      type
    });

  return { success: true, sent: totalSent, failed: totalFailed };
}
