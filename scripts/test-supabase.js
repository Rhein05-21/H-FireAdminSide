const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const { data: devices, error: devErr } = await supabase.from('devices').select('*').limit(10);
    console.log('Devices query result:', { count: devices?.length, error: devErr?.message });
    if (devices && devices.length > 0) {
      console.log('Sample device:', devices[0]);
    }

    const { data: profiles, error: profErr } = await supabase.from('profiles').select('*').limit(10);
    console.log('Profiles query result:', { count: profiles?.length, error: profErr?.message });

    const { data: incidents, error: incErr } = await supabase.from('incidents').select('*').limit(10);
    console.log('Incidents query result:', { count: incidents?.length, error: incErr?.message });

    const { data: logs, error: logsErr } = await supabase.from('gas_logs').select('*').limit(10);
    console.log('Gas Logs query result:', { count: logs?.length, error: logsErr?.message });

    console.log('✅ Supabase Connection Test Completed!');
  } catch (err) {
    console.error('Connection test error:', err.message);
  }
}

test();
