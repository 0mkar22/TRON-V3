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
// 1. GITHUB REPOSITORIES (Dynamic DB Token)
// ==========================================
router.get('/github-repos', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        console.log(`🔍 [ADMIN] Fetching GitHub repos for Org: ${orgId}`);
        
        const { data, error } = await supabaseAdmin
            .from('integrations')
            .select('token')
            .eq('org_id', orgId)
            .eq('provider', 'github')
            .single();

        if (error || !data?.token) return res.json({ repos: [] });

        const response = await axios.get('https://api.github.com/user/repos', {
            headers: {
                'Authorization': `token ${data.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            params: { visibility: 'all', affiliation: 'owner,collaborator,organization_member', sort: 'updated', per_page: 100 }
        });

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
        res.status(500).json({ error: 'Failed to fetch repositories. Is the PAT valid?' });
    }
});

// ==========================================
// 2. BASECAMP PROJECTS (Self-Healing Fetch)
// ==========================================
router.get('/basecamp-projects', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        console.log(`🔍 [ADMIN] Fetching Basecamp projects for Org: ${orgId}`);
        
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
// 3. BASECAMP COLUMNS (Kanban/Todo Mapping)
// ==========================================
router.post('/basecamp-columns', async (req, res) => {
    const { projectId, orgId } = req.body;
    if (!projectId || !orgId) return res.status(400).json({ error: 'Missing Project ID or Org ID.' });

    try {
        console.log(`🔍 [ADMIN] Fetching Basecamp columns for Project: ${projectId}`);

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
// 4. DISCORD CHANNELS (Dynamic Match)
// ==========================================
router.get('/discord-status', async (req, res) => {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).json({ error: 'Missing orgId query parameter.' });

    try {
        const { data, error } = await supabaseAdmin
            .from('integrations')
            .select('token')
            .eq('org_id', orgId)
            .in('provider', ['discord', 'discord_bot'])
            .single();

        if (error || !data?.token) return res.json({ channels: [] });

        const headers = { 'Authorization': `Bot ${data.token}` };
        
        const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', { headers });
        if (guildsRes.data.length === 0) return res.json({ channels: [] });

        const guildId = guildsRes.data[0].id;
        const channelsRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
        
        const channels = channelsRes.data
            .filter(c => c.type === 0)
            .map(c => ({ id: c.id, name: c.name }));

        res.json({ channels });
    } catch (error) {
        console.error('❌ [ADMIN] Discord Fetch Error:', error.response?.data || error.message);
        res.json({ channels: [] });
    }
});

// ==========================================
// 5. SECURE INTEGRATION SAVING (🌟 FIXED)
// ==========================================
router.post('/save-integration', async (req, res) => {
    const { provider, token, orgId } = req.body;
    if (!provider || !token || !orgId) return res.status(400).json({ error: 'Missing data' });
    
    try {
        // Safe Find-and-Update bypasses the need for strict DB constraints
        const { data: existing } = await supabaseAdmin
            .from('integrations')
            .select('id')
            .eq('org_id', orgId)
            .eq('provider', provider)
            .single();

        if (existing) {
            await supabaseAdmin.from('integrations').update({ token }).eq('id', existing.id);
        } else {
            await supabaseAdmin.from('integrations').insert({ provider, token, org_id: orgId });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`❌ [ADMIN] Failed to save ${provider}:`, error.message);
        res.status(500).json({ error: "Database save failed" });
    }
});

router.post('/discord-token', async (req, res) => {
    const { token, orgId } = req.body;
    if (!token || !orgId) return res.status(400).json({ error: 'Missing data' });
    
    try {
        const { data: existing } = await supabaseAdmin
            .from('integrations')
            .select('id')
            .eq('org_id', orgId)
            .eq('provider', 'discord')
            .single();

        if (existing) {
            await supabaseAdmin.from('integrations').update({ token }).eq('id', existing.id);
        } else {
            await supabaseAdmin.from('integrations').insert({ provider: 'discord', token, org_id: orgId });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`❌ [ADMIN] Failed to save Discord token:`, error.message);
        res.status(500).json({ error: "Database save failed" });
    }
});

router.delete('/delete-integration/:provider', async (req, res) => {
    const { orgId } = req.body;
    const { provider } = req.params;
    await supabaseAdmin.from('integrations').delete().match({ provider, org_id: orgId });
    res.json({ success: true });
});

router.delete('/discord-token', async (req, res) => {
    const { orgId } = req.body;
    await supabaseAdmin.from('integrations').delete().match({ provider: 'discord', org_id: orgId });
    await supabaseAdmin.from('integrations').delete().match({ provider: 'discord_bot', org_id: orgId });
    res.json({ success: true });
});

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