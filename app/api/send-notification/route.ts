import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

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
    const { token, title, body: notificationBody } = body;

    if (!token || !title || !notificationBody) {
      return NextResponse.json(
        { error: "Missing required fields: token, title, or body." },
        { status: 400 }
      );
    }

    const message = {
      data: {
        title,
        body: notificationBody,
      },
      webpush: {
        notification: {
          title,
          body: notificationBody,
        }
      },
      token,
    };

    const response = await admin.messaging().send(message);
    
    return NextResponse.json({ success: true, messageId: response }, { status: 200 });

  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}