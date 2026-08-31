const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: logs, error } = await supabase
    .from('gas_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Gas logs query error:', error?.message);
  console.log('Latest gas logs count:', logs?.length);
  console.log('Logs:', logs);

  const { data: devices } = await supabase.from('devices').select('*');
  console.log('Devices in DB:', devices);
}

check();
