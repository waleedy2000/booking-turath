import { NextResponse } from "next/server";
import { sendToEntityDirect } from "@/lib/notification-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entity_id, title, body: notificationBody } = body;

    if (!title || !notificationBody || !entity_id) {
      return NextResponse.json(
        { error: "Missing required fields: entity_id, title or body." },
        { status: 400 }
      );
    }

    const result = await sendToEntityDirect(entity_id, title, notificationBody);
    
    if (result && !result.success) {
       return NextResponse.json({ error: result.error || "Failed to push" }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}