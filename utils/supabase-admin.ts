import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

// SERVICE ROLE key — bypasses RLS entirely.
// ⚠️  NEVER expose this key on the client side.
// Only import this file in server-side code (API routes / Server Components).
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // Disable auto-refresh and session persistence for server-side usage
    autoRefreshToken: false,
    persistSession: false,
  },
})
