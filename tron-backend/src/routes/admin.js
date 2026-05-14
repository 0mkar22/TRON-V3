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

        if (integration?.secret_id && !actualToken) {
            console.log(`🐛 [DEBUG ADMIN] Accessing Vault for GitHub Secret via RPC...`);
            const { data: decryptedSecret, error: rpcError } = await supabaseAdmin.rpc('get_decrypted_secret', {
                p_secret_id: integration.secret_id
            });
            
            if (decryptedSecret) {
                actualToken = decryptedSecret;
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: SUCCESS`);
            } else {
                console.log(`🐛 [DEBUG ADMIN] Vault Decryption: FAILED`);
                if (rpcError) console.error(rpcError.message);
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
        const columns = await BasecampAdapter.executeWithRetry(orgId, async (creds) => {
            const headers = BasecampAdapter.getBaseConfig(creds.accessToken);
            
            // 1. Fetch the project dock
            const projectRes = await axios.get(`https://3.basecampapi.com/${creds.accountId}/projects/${projectId}.json`, headers);
            
            // 2. STRICT PRIORITY: Grab Kanban Board first, fall back to To-Do set
            let tool = projectRes.data.dock.find(t => t.name === 'kanban_board' || t.name === 'card_table');
            if (!tool) tool = projectRes.data.dock.find(t => t.name === 'todoset');
            if (!tool || !tool.url) throw new Error('No Card Table or To-Do list found.');

            // 3. Fetch the metadata for the specific tool
            const toolRes = await axios.get(tool.url, headers);
            
            let rawLists = toolRes.data.lists || toolRes.data.columns || toolRes.data.todolists;
            
            // 🌟 THE FIX: If Basecamp hides the columns behind a 'lists_url', follow it!
            const targetUrl = toolRes.data.lists_url || toolRes.data.todolists_url;
            if (!rawLists && targetUrl) {
                console.log(`👉 Following Basecamp lists_url: ${targetUrl}`);
                const listsRes = await axios.get(targetUrl, headers);
                rawLists = listsRes.data;
            }

            if (!rawLists) rawLists = [];
            
            // 4. Format and return to the frontend
            return rawLists.map(list => ({
                id: list.id.toString(),
                name: list.title || list.name
            }));
        });

        res.json({ columns });
    } catch (error) {
        console.error('❌ [ADMIN] Basecamp Columns Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch columns from Basecamp.' });
    }
});

// ==========================================
// 4. DISCORD CHANNELS
// ==========================================
router.get('/discord-status', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        const { data: integrations } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('org_id', orgId)
            .in('provider', ['discord', 'discord_bot'])
            .limit(1);

        const integration = integrations?.[0];
        let actualToken = integration?.token;

        if (integration?.secret_id && !actualToken) {
            const { data: decryptedSecret } = await supabaseAdmin.rpc('get_decrypted_secret', {
                p_secret_id: integration.secret_id
            });
            
            if (decryptedSecret) {
                try {
                    const creds = JSON.parse(decryptedSecret);
                    actualToken = creds.botToken || creds.bot_token || creds.token || decryptedSecret;
                } catch (e) {
                    actualToken = decryptedSecret; 
                }
            }
        }

        if (!actualToken) return res.json({ channels: [] });

        const headers = { 'Authorization': `Bot ${actualToken}` };
        const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', { headers });
        if (guildsRes.data.length === 0) return res.json({ channels: [] });

        const guildId = guildsRes.data[0].id;
        const channelsRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
        
        const channels = channelsRes.data.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name }));
        res.json({ channels });
    } catch (error) {
        console.error('❌ [ADMIN] Discord Fetch Error:', error.message);
        res.json({ channels: [] });
    }
});

// ==========================================
// 5. SECURE DASHBOARD WORKFLOWS 
// ==========================================
router.get('/dashboard-workflows', async (req, res) => {
    const orgId = req.query.orgId;
    
    // 🔒 THE LOCK: Reject if orgId is missing
    if (!orgId) {
        return res.status(400).json({ error: 'Unauthorized: Missing orgId query parameter.' });
    }

    try {
        const { data: workflows, error } = await supabaseAdmin
            .from('repositories') 
            .select('*')
            .eq('org_id', orgId); // 🔒 Ensure it only fetches this tenant's workflows

        if (error) throw error;

        res.json({ workflows: workflows || [] });
    } catch (error) {
        console.error('❌ [ADMIN] Fetch Workflows Error:', error.message);
        res.json({ workflows: [] });
    }
});

// ==========================================
// 6. SECURE SYSTEM STATUS (Mission Control)
// ==========================================
router.get('/system-status', async (req, res) => {
    const orgId = req.query.orgId;
    
    // 🔒 THE LOCK: Reject if orgId is missing
    if (!orgId) {
        return res.status(400).json({ error: 'Unauthorized: Missing orgId query parameter.' });
    }

    try {
        // Fetch Queue Data from Supabase (safely filtered by org_id)
        const { data: queueData, error: queueError } = await supabaseAdmin
            .from('tasks') // Make sure you have a 'tasks' table in Supabase!
            .select('*')
            .eq('org_id', orgId);

        if (queueError && queueError.code !== '42P01') { 
            console.error("Queue fetch error:", queueError.message);
        }

        // Fetch AI Reviews from Supabase (safely filtered by org_id)
        const { data: reviewsData, error: reviewError } = await supabaseAdmin
            .from('ai_reviews') // Make sure you have an 'ai_reviews' table in Supabase!
            .select('*')
            .eq('org_id', orgId);

        if (reviewError && reviewError.code !== '42P01') {
            console.error("Review fetch error:", reviewError.message);
        }

        // Send the secure data back to the frontend
        res.json({
            queue: queueData || [],
            reviews: reviewsData || [],
            queueCount: (queueData || []).length,
            reviewCount: (reviewsData || []).length
        });
    } catch (error) {
        console.error('❌ [ADMIN] System Status Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

// ==========================================
// 7. TEAM MANAGEMENT: INVITE DEVELOPER
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
        res.status(500).json({ error: "Failed to send invite." });
    }
});

module.exports = router;