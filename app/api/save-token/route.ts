import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, phone, user_id, entity_id } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // ✅ Use upsert with onConflict to prevent duplicates and update existing records
    const upsertData: any = {
      token,
      last_seen_at: new Date().toISOString(),
    };

    // Phone normalization helper
    const normalizePhone = (p: string) => {
      let phone = p.trim();
      if (!phone.startsWith('+')) {
        if (phone.startsWith('965')) phone = '+' + phone;
        else phone = '+965' + phone;
      }
      return phone;
    };

    // Add optional fields if provided in the payload
    if (phone) upsertData.phone = normalizePhone(phone);
    if (user_id) upsertData.user_id = user_id;
    if (entity_id) upsertData.entity_id = entity_id;

    const { error: upsertError } = await supabase
      .from("push_tokens")
      .upsert(upsertData, { onConflict: "token" });

    if (upsertError) {
      console.error("Error upserting token in Supabase:", upsertError);
      return NextResponse.json(
        { error: "Failed to save token" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing save-token request:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}