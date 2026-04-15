import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabaseAdmin = getSupabaseAdmin();

export async function POST(req: Request) {
  const { phone, token } = await req.json();

  if (!phone || !token) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  // 1️⃣ get or create user
  let { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!user) {
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert({ phone })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    user = newUser;
  }

  // 2️⃣ save token
  const { error: tokenError } = await supabaseAdmin
    .from("push_tokens")
    .upsert({
      token,
      user_id: user.id,
    });

  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
