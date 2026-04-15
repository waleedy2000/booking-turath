import { supabaseAdmin } from "@/utils/supabase-admin";

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("*")
    .limit(1)
    .single();

  return data;
}
