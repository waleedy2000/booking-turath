import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabaseAdmin = getSupabaseAdmin();

export async function POST(req: Request) {
  const { phone, token } = await req.json();

  if (!phone || !token) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  // Phone normalization helper
  const normalizePhone = (p: string) => {
    let phone = p.trim();
    if (!phone.startsWith('+')) {
      if (phone.startsWith('965')) phone = '+' + phone;
      else phone = '+965' + phone;
    }
    return phone;
  };

  const cleanPhone = normalizePhone(phone);

  // ✅ Phone-based token registration (unified identity)
  // Upsert token with phone + update last_seen
  const { error: tokenError } = await supabaseAdmin
    .from("push_tokens")
    .upsert(
      {
        token,
        phone: cleanPhone,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

  if (tokenError) {
    console.error("[RegisterDevice] Token upsert error:", tokenError);
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  // Also maintain legacy users table for backward compatibility
  let { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (!user) {
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert({ phone: cleanPhone })
      .select()
      .single();

    if (error) {
      console.warn("[RegisterDevice] User creation failed (non-blocking):", error.message);
    } else {
      user = newUser;
    }
  }

  // Update push_token with user_id if available (backward compat)
  if (user) {
    await supabaseAdmin
      .from("push_tokens")
      .update({ user_id: user.id })
      .eq("token", token);
  }

  return NextResponse.json({ success: true });
}
