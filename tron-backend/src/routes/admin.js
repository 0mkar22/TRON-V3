// src/routes/admin.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const BasecampAdapter = require('../adapters/basecamp');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

// 🌟 INITIALIZE ADMIN CLIENT FOR VAULT ACCESS
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==========================================
// 1. GITHUB REPOSITORIES (Vault Secured)
// ==========================================
router.get('/github-repos', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        console.log(`\n==========================================`);
        console.log(`🐛 [DEBUG ADMIN] Fetching GitHub repos for Org: ${orgId}`);
        
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('org_id', orgId)
            .eq('provider', 'github')
            .maybeSingle();

        let actualToken = integration?.token;

        // 🌟 THE FIX: Decrypt from Vault if secret_id exists
        if (integration?.secret_id && !actualToken) {
            console.log(`🐛 [DEBUG ADMIN] Accessing Vault for GitHub Secret...`);
            const { data: secret } = await supabaseAdmin
                .from('vault.decrypted_secrets')
                .select('decrypted_secret')
                .eq('id', integration.secret_id)
                .maybeSingle();
            
            if (secret) {
                actualToken = secret.decrypted_secret;
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: SUCCESS`);
            } else {
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: FAILED (Secret not found)`);
            }
        }

        if (!actualToken) {
            console.log(`🐛 [DEBUG ADMIN] No valid token found, returning empty repos.`);
            return res.json({ repos: [] });
        }

        const response = await axios.get('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `token ${actualToken}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            params: { visibility: 'all', affiliation: 'owner,collaborator,organization_member', sort: 'updated', per_page: 100 }
        });

        console.log(`🐛 [DEBUG ADMIN] Successfully fetched ${response.data.length} repos from GitHub API!`);
        console.log(`==========================================\n`);

        const repos = response.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name, 
            private: repo.private,
            url: repo.html_url
        }));

        res.json({ repos });
    } catch (error) {
        console.error('❌ [ADMIN] GitHub API Error:', error.response?.data || error.message);
        res.json({ repos: [] });
    }
});

// ==========================================
// 2. BASECAMP PROJECTS
// ==========================================
router.get('/basecamp-projects', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        const response = await BasecampAdapter.executeWithRetry(orgId, (creds) => 
            axios.get(
                `https://3.basecampapi.com/${creds.accountId}/projects.json`,
                BasecampAdapter.getBaseConfig(creds.accessToken)
            )
        );

        const projects = response.data.map(project => ({
            id: project.id.toString(),
            name: project.name,
            provider: 'basecamp'
        }));

        res.json({ projects });
    } catch (error) {
        console.error('❌ [ADMIN] Basecamp API Error:', error.message);
        res.json({ projects: [] }); 
    }
});

// ==========================================
// 3. BASECAMP COLUMNS
// ==========================================
router.post('/basecamp-columns', async (req, res) => {
    const { projectId, orgId } = req.body;
    if (!projectId || !orgId) return res.status(400).json({ error: 'Missing Project ID or Org ID.' });

    try {
        const response = await BasecampAdapter.executeWithRetry(orgId, async (creds) => {
            const headers = BasecampAdapter.getBaseConfig(creds.accessToken);
            
            const projectRes = await axios.get(`https://3.basecampapi.com/${creds.accountId}/projects/${projectId}.json`, headers);
            let tool = projectRes.data.dock.find(t => t.name === 'kanban_board' || t.name === 'card_table' || t.name === 'todoset');
            
            if (!tool) throw new Error('No Card Table or To-Do list found.');

            return axios.get(tool.url, headers);
        });

        const toolData = response.data;
        const rawLists = toolData.lists || toolData.todolists || [];
        
        const columns = rawLists.map(list => ({
            id: list.id.toString(),
            name: list.title || list.name
        }));

        res.json({ columns });
    } catch (error) {
        console.error('❌ [ADMIN] Basecamp Columns Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch columns from Basecamp.' });
    }
});

// ==========================================
// 4. DISCORD CHANNELS (Vault Secured)
// ==========================================
router.get('/discord-status', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        console.log(`\n==========================================`);
        console.log(`🐛 [DEBUG ADMIN] Fetching Discord channels for Org: ${orgId}`);

        // 🌟 THE FIX: Use .limit(1) to avoid crashing when both discord and discord_bot rows exist!
        const { data: integrations, error } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('org_id', orgId)
            .in('provider', ['discord', 'discord_bot'])
            .limit(1);

        const integration = integrations?.[0];
        let actualToken = integration?.token;

        // 🌟 THE FIX: Decrypt from Vault if secret_id exists
        if (integration?.secret_id && !actualToken) {
            console.log(`🐛 [DEBUG ADMIN] Accessing Vault for Discord Secret...`);
            const { data: secret } = await supabaseAdmin
                .from('vault.decrypted_secrets')
                .select('decrypted_secret')
                .eq('id', integration.secret_id)
                .maybeSingle();
            
            if (secret) {
                // Determine if the secret is raw or JSON wrapped
                try {
                    const creds = JSON.parse(secret.decrypted_secret);
                    actualToken = creds.botToken || creds.bot_token || creds.token || secret.decrypted_secret;
                } catch (e) {
                    actualToken = secret.decrypted_secret; // It was a raw string
                }
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: SUCCESS`);
            } else {
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: FAILED (Secret not found)`);
            }
        }

        if (!actualToken) {
            console.log(`🐛 [DEBUG ADMIN] No valid token found, returning empty channels.`);
            return res.json({ channels: [] });
        }

        const headers = { 'Authorization': `Bot ${actualToken}` };
        
        const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', { headers });
        if (guildsRes.data.length === 0) {
            console.log(`🐛 [DEBUG ADMIN] Bot is not inside any Discord servers.`);
            return res.json({ channels: [] });
        }

        const guildId = guildsRes.data[0].id;
        const channelsRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
        
        const channels = channelsRes.data
            .filter(c => c.type === 0)
            .map(c => ({ id: c.id, name: c.name }));

        console.log(`🐛 [DEBUG ADMIN] Successfully fetched ${channels.length} text channels!`);
        console.log(`==========================================\n`);

        res.json({ channels });
    } catch (error) {
        console.error('❌ [ADMIN] Discord Fetch Error:', error.response?.data || error.message);
        res.json({ channels: [] });
    }
});

// ==========================================
// 5. LEGACY RENDER ROUTES (Unused, kept for fallback)
// ==========================================
router.post('/save-integration', async (req, res) => res.json({ success: true }));
router.post('/discord-token', async (req, res) => res.json({ success: true }));
router.delete('/delete-integration/:provider', async (req, res) => res.json({ success: true }));
router.delete('/discord-token', async (req, res) => res.json({ success: true }));

// ==========================================
// 6. TEAM MANAGEMENT: INVITE DEVELOPER
// ==========================================
router.post('/invite-developer', requireAuth, async (req, res) => {
    const { email } = req.body;
    const orgId = req.user?.org_id; 

    if (!email) return res.status(400).json({ error: "Email is required." });
    if (!orgId) return res.status(401).json({ error: "Unauthorized: Missing Organization ID." });

    try {
        console.log(`✉️ [ADMIN] Attempting to invite ${email} to Org: ${orgId}`);

        const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { org_id: orgId, role: 'developer' },
            redirectTo: 'https://tron-v3.vercel.app/onboarding/set-password' 
        });

        if (inviteError) throw inviteError;

        const { error: dbError } = await supabaseAdmin
            .from('users')
            .upsert({ 
                id: data.user.id, email: email, org_id: orgId, role: 'developer' 
            }, { onConflict: 'id' });

        if (dbError) throw dbError;

        console.log(`✅ [ADMIN] Successfully invited ${email}`);
        res.json({ message: `Invite sent to ${email} successfully!` });

    } catch (error) {
        console.error("❌ [ADMIN] Invite Error:", error.message);
        res.status(500).json({ error: "Failed to send invite. Check server logs." });
    }
});

module.exports = router;