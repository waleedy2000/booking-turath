import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabaseAdmin = getSupabaseAdmin();

export async function getSettings() {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("*")
    .limit(1)
    .single();

  return data;
}
