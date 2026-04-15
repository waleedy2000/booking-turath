const fs = require('fs');
const path = require('path');

// 1. Rewrite utils/supabase-admin.ts
const adminPath = path.join(__dirname, 'utils', 'supabase-admin.ts');
const adminContent = `import { createClient } from "@supabase/supabase-js";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env vars are missing");
  }

  supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseAdmin;
}
`;
fs.writeFileSync(adminPath, adminContent);

// 2. Search and replace in all other files
function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (fullPath === adminPath) continue;

      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Handle 'import { supabaseAdmin as supabase } from ...'
      const pattern1 = /import\s+\{\s*supabaseAdmin\s+as\s+supabase\s*\}\s+from\s+['"]@\/utils\/supabase-admin['"];?/g;
      if (pattern1.test(content)) {
        content = content.replace(pattern1, 'import { getSupabaseAdmin } from "@/utils/supabase-admin";\nconst supabase = getSupabaseAdmin();');
        changed = true;
      }

      // Handle 'import { supabaseAdmin } from ...'
      const pattern2 = /import\s+\{\s*supabaseAdmin\s*\}\s+from\s+['"]@\/utils\/supabase-admin['"];?/g;
      if (pattern2.test(content)) {
        content = content.replace(pattern2, 'import { getSupabaseAdmin } from "@/utils/supabase-admin";\nconst supabaseAdmin = getSupabaseAdmin();');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'app'));
replaceInDir(path.join(__dirname, 'lib'));
console.log('Done!');
