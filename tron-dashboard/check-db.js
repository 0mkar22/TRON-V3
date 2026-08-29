const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.+)/)[1].trim();
const SUPABASE_SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: users, error } = await supabase.from('users').select('id, org_id, role');
    console.log(users, error);
}
check();
