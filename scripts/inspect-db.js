const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('--- PROFILES ---');
  console.log(JSON.stringify(profiles, null, 2));

  const { data: incidents } = await supabase.from('incidents').select('*').limit(3);
  console.log('--- INCIDENTS ---');
  console.log(JSON.stringify(incidents, null, 2));

  const { data: devices } = await supabase.from('devices').select('*, profiles(*)');
  console.log('--- DEVICES (with profiles join) ---');
  console.log(JSON.stringify(devices, null, 2));
}

inspect();
