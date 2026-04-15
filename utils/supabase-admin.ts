import { createClient } from "@supabase/supabase-js";

let supabaseAdminInstance: any = null;

export function getSupabaseAdmin(): any {
  return new Proxy({}, {
    get(target, prop) {
      if (!supabaseAdminInstance) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
          throw new Error("Supabase env vars are missing");
        }

        supabaseAdminInstance = createClient(url, key, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      }
      return supabaseAdminInstance[prop];
    }
  });
}
