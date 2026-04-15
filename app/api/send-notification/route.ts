import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, body: notificationBody } = body;

    if (!title || !notificationBody) {
      return NextResponse.json(
        { error: "Missing required fields: title or body." },
        { status: 400 }
      );
    }

    // 1) Fetch all tokens from Supabase
    const { data: tokensData, error: dbError } = await supabase
      .from('push_tokens')
      .select('token');

    if (dbError) {
      console.error("Database error fetching tokens:", dbError);
      return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
    }

    if (!tokensData || tokensData.length === 0) {
      return NextResponse.json({ success: true, message: "No registered tokens found" }, { status: 200 });
    }

    // 2) Map to array
    const tokens = tokensData?.map(t => t.token) || [];

    if (!tokens.length) {
      return NextResponse.json({ success: false, message: 'No tokens found' });
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
        data: {
          title,
          body: notificationBody,
        },
        webpush: {
          notification: {
            title,
            body: notificationBody,
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
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

    // 5) Return response
    return NextResponse.json({ 
      success: true, 
      sent: totalSent,
      failed: totalFailed 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error sending bulk notification:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}