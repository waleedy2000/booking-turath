import * as admin from "firebase-admin";
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

let cachedApp: admin.app.App | null = null;

function getFirebaseAdminApp() {
  if (cachedApp) return cachedApp;

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountStr) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing in environment variables.");
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountStr);

    cachedApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

    return cachedApp;
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
    throw error;
  }
}

function getMessaging() {
  return getFirebaseAdminApp().messaging();
}

/**
 * Smart Retry Wrapper for external network calls (e.g. Firebase)
 */
async function sendWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, 500));
    return sendWithRetry(fn, retries - 1);
  }
}

/**
 * ✅ NEW: Phone-based push notification sender.
 * Sends push notifications to all devices registered with the given phone numbers.
 */
export async function sendPushToPhones(
  phones: string[],
  title: string,
  body: string,
  type: string = "booking",
  departmentId?: string
) {
  if (!phones.length) {
    return { success: true, message: 'No phones provided', sent: 0, failed: 0 };
  }

  // 1) Idempotency Check (within 10 seconds, same department + title)
  if (departmentId) {
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const { data: recentLogs } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('entity_id', departmentId)
      .eq('title', title)
      .gte('created_at', tenSecondsAgo)
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      console.log('[NotificationService] Idempotency block: Duplicate notification throttled.');
      return { success: true, message: 'Notification throttled (idempotency)', sent: 0, failed: 0 };
    }
  }

  // 2) Fetch tokens by phone numbers
  const { data: tokensData, error: dbError } = await supabase
    .from('push_tokens')
    .select('token')
    .in('phone', phones)
    .not('token', 'is', null);

  if (dbError) {
    console.error("[NotificationService] Database error fetching tokens:", dbError);
    return { success: false, error: "Failed to fetch tokens" };
  }

  // Deduplicate tokens
  const tokens: string[] = [...new Set<string>(tokensData?.map((t: { token: string }) => t.token) || [])];

  if (!tokens.length) {
    console.log('[NotificationService] No tokens found for phones:', phones);
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
      getMessaging().sendEachForMulticast(message)
    );
    
    totalSent += response.successCount;
    totalFailed += response.failureCount;

    response.responses.forEach((res: admin.messaging.SendResponse, idx: number) => {
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

    // Rate Limiting / Quota Protection
    if (i + chunkSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // 4) Remove unregistered tokens from Supabase
  if (failedTokens.length > 0) {
    for (let i = 0; i < failedTokens.length; i += 200) {
      await supabase
        .from('push_tokens')
        .delete()
        .in('token', failedTokens.slice(i, i + 200));
    }
  }

  // 5) Log the notification
  const status = totalFailed > 0 ? (totalSent > 0 ? 'partial_failure' : 'failed') : 'sent';
  const errorReason = totalFailed > 0 ? `Failed tokens: ${totalFailed}` : null;

  await supabase
    .from('notification_logs')
    .insert({
      entity_id: departmentId || null,
      title,
      body,
      status,
      error: errorReason,
      type
    });

  return { success: true, sent: totalSent, failed: totalFailed };
}

/**
 * @deprecated Kept for backward compatibility. Use sendPushToPhones instead.
 */
export async function sendToEntityDirect(entity_id: string, title: string, body: string, type: string = "booking") {
  // Resolve phones from users table (legacy path)
  const { data: usersData } = await supabase
    .from('users')
    .select('phone')
    .eq('entity_id', entity_id);

  const phones = usersData?.map((u: { phone: string }) => u.phone).filter(Boolean) || [];

  if (!phones.length) {
    // Fallback: try department_participants
    const { data: participants } = await supabase
      .from('department_participants')
      .select('phone')
      .eq('department_id', entity_id)
      .eq('is_active', true);

    const partPhones = participants?.map((p: { phone: string }) => p.phone) || [];
    if (partPhones.length) {
      return sendPushToPhones(partPhones, title, body, type, entity_id);
    }

    return { success: true, message: 'No phones found for entity', sent: 0, failed: 0 };
  }

  return sendPushToPhones(phones, title, body, type, entity_id);
}
