const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Since we don't have a specific RPC for grouping, we fetch all and group in JS to be safe.
  const { data: bookings, error: bError } = await supabase.from('bookings').select('date, start_time');
  
  if (bError) {
    console.error("Error fetching bookings:", bError);
    process.exit(1);
  }

  const counts = {};
  for (const b of bookings) {
    const key = `${b.date}::${b.start_time}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  let hasDuplicates = false;
  for (const [key, count] of Object.entries(counts)) {
    if (count > 1) {
      console.log(`Duplicate found: ${key} (Count: ${count})`);
      hasDuplicates = true;
    }
  }

  if (hasDuplicates) {
    console.log("\nFOUND_DUPLICATES=true");
  } else {
    console.log("\nFOUND_DUPLICATES=false");
  }
}

check();
