const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Replace single queries for role/org_id
            content = content.replace(
                /await (supabase(?:Server)?)\.from\('users'\)\.select\('org_id(?:, role|)'\)\.eq\('id', user\.id\)\.single\(\)/g,
                "await \.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }))"
            );
            
            content = content.replace(
                /await (supabase(?:Server)?)\.from\('users'\)\.select\('org_id, role'\)\.eq\('id', user\.id\)\.single\(\)/g,
                "await \.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }))"
            );

            content = content.replace(
                /await (supabase(?:Server)?)\.from\('users'\)\.select\('role'\)\.eq\('id', user\.id\)\.single\(\)/g,
                "await \.from('organization_members').select('role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }))"
            );
            
            // Multiline in actions.js
            content = content.replace(
                /await (supabase(?:Server)?)\s*\n\s*\.from\('users'\)\s*\n\s*\.select\('org_id, role'\)\s*\n\s*\.eq\('id', user\.id\)\s*\n\s*\.single\(\)/g,
                "await \.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }))"
            );

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'src'));
