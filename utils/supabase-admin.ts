import { createClient } from "@supabase/supabase-js";

let client: any = null;

function getClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  if (typeof window !== "undefined") {
    throw new Error("Supabase Admin should not run on client");
  }

  console.log("✅ Supabase Admin Client Initialized");

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

export function getSupabaseAdmin(): any {
  return new Proxy({}, {
    get(target, prop) {
      const instance = getClient();
      return (instance as any)[prop];
    }
  });
}
