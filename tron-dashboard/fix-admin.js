const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.+)/)[1].trim();
const SUPABASE_SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    console.log('Fetching users...');
    const { data: users, error: userError } = await supabase.from('users').select('*');
    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('No users found.');
        return;
    }

    // Ensure organizations table exists and get one
    const { data: orgs, error: orgError } = await supabase.from('organizations').select('*');
    let orgId;
    if (orgError) {
        console.log('Organizations table might not exist or error:', orgError.message);
        orgId = '00000000-0000-0000-0000-000000000001'; // Mock UUID
    } else if (!orgs || orgs.length === 0) {
        const { data: newOrg } = await supabase.from('organizations').insert({ name: 'Default Admin Workspace' }).select().single();
        orgId = newOrg?.id;
    } else {
        orgId = orgs[0].id;
    }

    for (const user of users) {
        console.log('Assigning admin to user:', user.email);
        const { error: insertError } = await supabase.from('organization_members').upsert({
            org_id: orgId,
            user_id: user.id,
            role: 'admin'
        }, { onConflict: 'org_id,user_id' });
        if (insertError) {
            console.error('Error assigning admin:', insertError);
        } else {
            console.log('Successfully assigned admin to', user.email);
        }
    }
}
fix();
