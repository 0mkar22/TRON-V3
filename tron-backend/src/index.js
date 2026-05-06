require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const path = require('path');
const axios = require('axios');

// V3: Supabase Configuration
const { supabase } = require('./config/supabase.js'); 
const { getRepoConfigFromDB } = require('./config/db.js');

// Adapters & Middleware
const verifyGitHub = require('./middleware/verifyGitHub'); 
const PMOrchestrator = require('./adapters/pm-orchestrator');
const { requireAuth } = require('./middleware/auth');

// Routes
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const integrationRoutes = require('./routes/integrations.js'); 
const redis = require('./config/redis');

const app = express();
app.use(cors());

// Parse raw body for webhooks, JSON for everything else
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

const port = process.env.PORT || 3000;

// ==========================================
// INITIALIZE SERVICES
// ==========================================
redis.on('connect', () => console.log('📦 Connected to Redis Queue'));
redis.on('error', (err) => console.error('Redis Connection Error:', err));

// ==========================================
// MOUNT ROUTES
// ==========================================
app.use('/api/integrations', integrationRoutes); 
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// Serve the compiled React Dashboard 
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard/dist')));
app.get(/^\/dashboard/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
});

// 🌟 V3 Health Check: Verifies connection to PostgreSQL
app.get('/health', async (req, res) => {
    const { data, error } = await supabase.from('organizations').select('count').single();
    if (error) {
        return res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
    }
    res.json({ status: 'active', database: 'connected' });
});


// ==========================================
// DAEMON & VS CODE API (V3 DB Powered)
// ==========================================

// 🌟 NEW: Fetch Discord Channels via Bot Token
app.post('/api/discord/channels', async (req, res) => {
    const { botToken } = req.body;
    if (!botToken) return res.status(400).json({ error: 'Bot token required' });

    try {
        // 1. Find which server (guild) the bot is inside
        const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bot ${botToken}` }
        });
        
        if (guildsRes.data.length === 0) {
            return res.status(400).json({ error: "Bot is not in any Discord servers yet!" });
        }
        
        const guildId = guildsRes.data[0].id; // Grab the first server it finds

        // 2. Fetch all channels for that server
        const channelsRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` }
        });

        // 3. Filter out voice channels (Type 0 is standard Text Channels)
        const textChannels = channelsRes.data
            .filter(c => c.type === 0)
            .map(c => ({ id: c.id, name: c.name }));
            
        res.json({ channels: textChannels });
    } catch (error) {
        console.error("Discord API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Invalid token or Discord API error." });
    }
});

// 🌟 NEW: "Silent" route to create a ticket without starting a branch
app.post('/api/create-task', async (req, res) => {
    const { taskInput, repoName } = req.body;
    
    try {
        const config = await getRepoConfigFromDB(repoName);

        if (!config || !config.pm_tool || config.pm_tool.provider === "none") {
             return res.status(400).json({ error: "No PM tool configured in database." });
        }

        const newTaskId = await PMOrchestrator.resolveTask(config.pm_tool, taskInput, config.mapping);
        res.json({ resolvedId: newTaskId });
    } catch (error) {
        console.error("Task creation failed:", error);
        res.status(500).json({ error: "Task creation failed." });
    }
});

// 🌟 NEW: Start Task, Move Column & Assign
app.post('/api/start-task', async (req, res) => {
    const { taskInput, repoName, developer } = req.body;
    
    try {
        const config = await getRepoConfigFromDB(repoName);
        let resolvedTaskID = taskInput.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(); 

        if (config && config.pm_tool && config.pm_tool.provider !== "none") {
            resolvedTaskID = await PMOrchestrator.resolveTask(config.pm_tool, taskInput, config.mapping);
            
            const inProgressId = config.mapping.branch_created || config.mapping.in_progress;
            
            if (inProgressId) {
                console.log(`🚚 [API] Moving task [${resolvedTaskID}] to In Progress column...`);
                await PMOrchestrator.updateTicketStatus(config.pm_tool, resolvedTaskID, inProgressId);
            }

            // 🌟 NEW: Trigger the Auto-Assignment
            if (developer) {
                console.log(`👤 [API] Attempting to assign developer: ${developer}`);
                await PMOrchestrator.assignTicket(config.pm_tool, resolvedTaskID, developer);
            }
        }

        // Fire the Background Worker Event
        await redis.lpush('tron:webhook_queue', JSON.stringify({
            eventType: 'local_start',
            payload: { taskId: resolvedTaskID, repository: { full_name: repoName } }
        }));

        res.json({ resolvedId: resolvedTaskID });

    } catch (error) {
        console.error("❌ API Start Task Error:", error);
        res.status(500).json({ error: "Task resolution and movement failed." });
    }
});

// 🌟 NEW: Fetch all active projects
app.get('/api/projects', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.DAEMON_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { data, error } = await supabase.from('repositories').select('repo_name');
        if (error) throw error;
        
        const projectNames = data.map(p => p.repo_name);
        res.status(200).json({ projects: projectNames });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch projects from DB." });
    }
});

// 🌟 SECURED: Fetch Tickets for VS Code
app.get('/api/project/:encodedRepo/tickets', requireAuth, async (req, res) => {
    const repo = decodeURIComponent(req.params.encodedRepo);
    
    try {
        const config = await getRepoConfigFromDB(repo);
        if (!config || config.pm_tool.provider === "none") {
            return res.json({ tickets: [] });
        }

        // 🌟 THE FIX: Pass the verified req.user.org_id to the Orchestrator!
        const activeTickets = await PMOrchestrator.getTickets(config.pm_tool, config.mapping, req.user.org_id);
        res.json({ tickets: activeTickets }); 
    } catch (error) {
        console.error("❌ Failed to fetch tickets:", error.message);
        res.status(500).json({ error: "Failed to fetch tickets." });
    }
});


// ==========================================
// AI & WEBHOOK QUEUE
// ==========================================

// ✨ AI TASK SUGGESTIONS API
app.post('/api/suggest-tasks', async (req, res) => {
    const { codeDiff } = req.body;
    
    if (!codeDiff || codeDiff.trim().length === 0) {
        return res.json({ suggestions: [] });
    }

    try {
        const aiAdapter = require('./adapters/ai');
        const suggestions = await aiAdapter.generateTaskSuggestions(codeDiff);
        res.json({ suggestions });
    } catch (error) {
        console.error("❌ API Suggest Tasks Error:", error);
        res.status(500).json({ error: "Failed to generate suggestions." });
    }
});

// GITHUB WEBHOOK ENDPOINT
app.post('/webhook', /* verifyGitHub, */ async (req, res) => {
    res.status(200).send('Webhook received');

    const eventType = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];
    const payload = req.body;

    const isNewDelivery = await redis.setnx(`delivery:${deliveryId}`, 'processed');
    if (isNewDelivery === 0) return; 

    await redis.expire(`delivery:${deliveryId}`, 172800);

    if (eventType === 'pull_request') {
        const action = payload.action;
        if (!['opened', 'closed', 'reopened'].includes(action)) return;
    }

    console.log(`\n📥 Received Valid GitHub Event: [${eventType}] | Delivery ID: [${deliveryId}]`);

    const queueJob = { deliveryId, eventType, payload };
    await redis.lpush('tron:v3_secret_queue', JSON.stringify(queueJob));

    console.log(`📤 Successfully pushed Delivery ID: [${deliveryId}] to Redis!`);
});

// 🌟 UPDATED: Link a GitHub Repository to a PM Tool & Save Comm Config
app.post('/api/repositories', async (req, res) => {
    // 🌟 Notice we extract communication_config here now!
    const { orgId, repoName, pmProvider, pmProjectId, mapping, communication_config } = req.body; 
    
    try {
        const { data, error } = await supabase
            .from('repositories')
            .upsert([{
                org_id: orgId,
                repo_name: repoName,
                pm_provider: pmProvider,
                pm_project_id: pmProjectId,
                mapping: mapping,
                communication_config: communication_config // 🌟 Added to DB!
            }], { onConflict: 'repo_name' }); 

        if (error) throw error;
        
        res.status(200).json({ message: "Repository linked successfully." });
    } catch (error) {
        console.error("❌ Failed to save repository config:", error.message);
        res.status(500).json({ error: "Failed to save repository configuration." });
    }
});

// 🌟 FETCH AI REVIEW FOR VS CODE
app.get('/api/review/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const review = await redis.get(`ai_review:${taskId}`);
        
        if (!review) {
            return res.status(404).json({ error: "No AI review found for this task yet." });
        }
        res.json({ review });
    } catch (error) {
        console.error("❌ Failed to fetch AI review:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================================
// DASHBOARD & ADMIN ROUTES
// ==========================================

// 🌟 BULLETPROOF: Mission Control - Fetch Redis Queue & AI Reviews
app.get('/api/admin/system-status', async (req, res) => {
    try {
        // ⚠️ Change 'redis' here to match whatever is at the top of your file!
        const queueItems = await redis.lrange('tron:v3_secret_queue', 0, -1);
        
        // Safely parse the queue
        const parsedQueue = queueItems.map(item => {
            try { return JSON.parse(item); } 
            catch (e) { return { eventType: 'Unknown', payload: { repository: { full_name: 'Corrupted Task' } } }; }
        });

        // 2. Fetch AI Review History Keys
        const reviewKeys = await redis.keys('ai_review:*');
        const reviews = [];

        for (const key of reviewKeys) {
            try {
                const dataString = await redis.get(key);
                
                if (dataString) {
                    let data;
                    
                    // SMART PARSE: Try JSON first. If it's raw text, catch the error and wrap it!
                    try {
                        data = JSON.parse(dataString);
                    } catch (e) {
                        // It's raw text! Wrap it in an object so the frontend modal can read it
                        data = { review: dataString };
                    }

                    const taskId = key.split(':')[1];
                    
                    reviews.push({ 
                        taskId: taskId, 
                        key: key,
                        details: data 
                    });
                }
            } catch (redisError) {
                console.error(`⚠️ Failed to read key ${key}:`, redisError.message);
            }
        }

        res.json({
            queue: parsedQueue,
            reviews: reviews,
            queueCount: parsedQueue.length,
            reviewCount: reviews.length
        });
    } catch (error) {
        console.error("❌ System Status Error:", error);
        res.status(500).json({ error: "Failed to fetch system status." });
    }
});

// 1. Save GitHub Token
app.post('/api/admin/save-integration', async (req, res) => {
    const { provider, token, orgId } = req.body;

    if (!provider || !token || !orgId) {
        return res.status(400).json({ error: "Missing provider, token, or orgId" });
    }

    try {
        console.log(`👉 Saving ${provider} token for Org: ${orgId}`);

        // 1. Save the raw token to the Vault
        const { data: secretId, error: vaultError } = await supabase.rpc('insert_secret', {
            secret_name: `${provider}_token_${orgId}_${Date.now()}`,
            secret_description: `Access token for ${provider}`,
            secret_value: token // Just the raw string, no JSON parsing needed for a simple token
        });

        if (vaultError || !secretId) throw new Error(`Vault Error: ${vaultError?.message}`);

        // 2. Tie it to the organization in the DB
        const { error: dbError } = await supabase
            .from('integrations')
            .upsert({ 
                org_id: orgId,
                provider: provider, 
                secret_id: secretId 
            }, { onConflict: 'org_id, provider' });

        if (dbError) throw new Error(`DB Error: ${dbError.message}`);

        res.json({ success: true, message: `${provider} connected successfully!` });

    } catch (error) {
        console.error(`❌ ${provider} Save Error:`, error.message);
        res.status(500).json({ error: `Failed to save ${provider} integration.` });
    }
});

// 🌟 NEW: Fetch GitHub Repositories for the Dropdown
app.get('/api/admin/github-repos', async (req, res) => {
    try {
        // 1. Find the GitHub integration in the database
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('provider', 'github')
            .single();

        if (intError || !integration || !integration.secret_id) {
            return res.json({ isConnected: false, repos: [] });
        }

        // 2. Decrypt the PAT using Vault
        const { data: githubPat, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !githubPat) {
            return res.json({ isConnected: false, repos: [] });
        }

        // 3. Call the GitHub API to get the user's repositories
        const response = await axios.get('https://api.github.com/user/repos', {
            headers: {
                Authorization: `token ${githubPat}`,
                Accept: 'application/vnd.github.v3+json'
            },
            params: {
                per_page: 100, // Fetch up to 100 recent repos
                sort: 'updated' // Show the most recently active ones first
            }
        });

        // 4. Map the response to just the data the frontend needs
        const repos = response.data.map(repo => ({
            id: repo.id,
            full_name: repo.full_name // e.g., "Omkar22/git-playground"
        }));

        res.json({ isConnected: true, repos: repos });

    } catch (error) {
        console.error("❌ GitHub Fetch Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch repositories from GitHub." });
    }
});

// 🌟 NEW: Check GitHub Connection Status for the Integrations Page
app.get('/api/admin/github-status', async (req, res) => {
    try {
        // Just check if a row exists for 'github'
        const { data, error } = await supabase
            .from('integrations')
            .select('id')
            .eq('provider', 'github')
            .single();

        if (error || !data) {
            return res.json({ isConnected: false });
        }

        res.json({ isConnected: true });
    } catch (error) {
        console.error("❌ GitHub Status Error:", error.message);
        res.json({ isConnected: false });
    }
});

// 🌟 NEW: Check GitHub Connection Status for the Integrations Page
app.get('/api/admin/basecamp-status', async (req, res) => {
    try {
        // Just check if a row exists for 'github'
        const { data, error } = await supabase
            .from('integrations')
            .select('id')
            .eq('provider', 'basecamp')
            .single();

        if (error || !data) {
            return res.json({ isConnected: false });
        }

        res.json({ isConnected: true });
    } catch (error) {
        console.error("❌ basecamp-status Error:", error.message);
        res.json({ isConnected: false });
    }
});

// 3. Delete Integrations (GitHub & Basecamp)
app.delete('/api/admin/delete-integration/:provider', async (req, res) => {
    const { provider } = req.params;
    const { orgId } = req.body;

    if (!orgId) return res.status(400).json({ error: "Missing orgId" });

    try {
        console.log(`🗑️ Disconnecting ${provider} for Org: ${orgId}`);
        
        // When we delete the row, Supabase Vault unfortunately doesn't auto-delete the secret.
        // We just delete the row here. A true production app would run a cron-job to clear orphaned Vault secrets.
        await supabase
            .from('integrations')
            .delete()
            .eq('provider', provider)
            .eq('org_id', orgId);

        res.json({ success: true, message: `${provider} disconnected.` });
    } catch (error) {
        console.error(`❌ Disconnect Error (${provider}):`, error.message);
        res.status(500).json({ error: `Failed to disconnect ${provider}.` });
    }
});

// 🌟 Start the Basecamp OAuth Dance (Diagnostic Edition)
app.post('/api/auth/basecamp/init', async (req, res) => {
    const { accountId, clientId, clientSecret, orgId } = req.body;

    if (!accountId || !clientId || !clientSecret || !orgId) {
        return res.status(400).json({ error: "Missing Basecamp credentials or Org ID." });
    }

    try {
        console.log(`👉 Starting Basecamp auth for Org: ${orgId}`);

        const pendingData = JSON.stringify({ accountId, clientId, clientSecret });

        // 1. Save to Vault (Added Date.now() back to prevent duplicate name crashes!)
        const { data: secretId, error: vaultError } = await supabase.rpc('insert_secret', {
            secret_name: `basecamp_pending_${orgId}_${Date.now()}`,
            secret_description: `Pending OAuth keys for Basecamp`,
            secret_value: pendingData
        });

        if (vaultError) throw new Error(`Vault Error: ${vaultError.message}`);
        if (!secretId) throw new Error(`Vault Error: No secret_id returned`);

        // 2. Save to Integrations table
        const { error: dbError } = await supabase
            .from('integrations')
            .upsert({ 
                org_id: orgId,
                provider: 'basecamp_pending', 
                secret_id: secretId
            }, { onConflict: 'org_id, provider' });

        if (dbError) throw new Error(`DB Error: ${dbError.message}`);

        // 3. Construct URL
        const redirectUri = encodeURIComponent("https://tron-v3.onrender.com/api/auth/basecamp/callback");
        const stateParam = encodeURIComponent(orgId); 
        const authUrl = `https://launchpad.37signals.com/authorization/new?type=web_server&client_id=${clientId}&redirect_uri=${redirectUri}&state=${stateParam}`;

        res.json({ success: true, redirectUrl: authUrl });

    } catch (error) {
        console.error("❌ Basecamp Init Error:", error.message);
        
        // 🌟 FIX: Stop hiding the error! Send the exact details to the frontend.
        res.status(500).json({ 
            error: "Failed to initialize Basecamp auth.",
            details: error.message 
        });
    }
});

// 🌟 Catch the Basecamp OAuth Redirect (Diagnostic Edition)
app.get('/api/auth/basecamp/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code) return res.status(400).json({ error: "No authorization code provided." });

    try {
        console.log("👉 Catching Basecamp redirect...");

        const returnedOrgId = state ? decodeURIComponent(state) : null;
        if (!returnedOrgId) throw new Error("Missing Org ID in state parameter.");

        console.log(`🔍 Looking for pending credentials for Org: ${returnedOrgId}`);

        const { data: pendingInt, error: pendingError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('provider', 'basecamp_pending')
            .eq('org_id', returnedOrgId)
            .single();

        if (pendingError || !pendingInt) throw new Error(`Could not find pending credentials. DB Error: ${pendingError?.message}`);

        console.log("✅ Found pending credentials. Decrypting...");

        const { data: decryptedJson, error: decryptError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: pendingInt.secret_id
        });

        if (decryptError || !decryptedJson) throw new Error("Failed to decrypt pending credentials.");

        const { accountId, clientId, clientSecret } = JSON.parse(decryptedJson);

        console.log("✅ Decrypted successfully. Exchanging code for tokens...");

        const redirectUri = encodeURIComponent("https://tron-v3.onrender.com/api/auth/basecamp/callback");
        const tokenUrl = `https://launchpad.37signals.com/authorization/token?type=web_server&client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`;

        const tokenResponse = await axios.post(tokenUrl);
        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        console.log("✅ Tokens received. Saving to Vault...");

        const finalCredentials = JSON.stringify({
            accountId, clientId, clientSecret,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000)
        });

        const { data: finalSecretId, error: vaultError } = await supabase.rpc('insert_secret', {
            secret_name: `basecamp_active_${returnedOrgId}_${Date.now()}`,
            secret_description: `Active OAuth keys for Basecamp`,
            secret_value: finalCredentials
        });

        if (vaultError || !finalSecretId) throw new Error(`Vault Error: ${vaultError?.message}`);

        console.log("✅ Saved to Vault. Upserting to integrations table...");

        // 🌟 Adding .select() forces Supabase to return the newly created row!
        const { data: upsertData, error: upsertError } = await supabase
            .from('integrations')
            .upsert({
                provider: 'basecamp',
                secret_id: finalSecretId,
                org_id: returnedOrgId
            }, { onConflict: 'org_id, provider' })
            .select(); 

        if (upsertError) throw new Error(`DB Upsert Error: ${upsertError.message}`);

        console.log("✅ Upsert complete. Deleting pending row...");

        await supabase
            .from('integrations')
            .delete()
            .eq('provider', 'basecamp_pending')
            .eq('org_id', returnedOrgId);

        console.log("🎉 All done! Sending success response.");

       // Redirect back to the TRON dashboard!
        res.redirect('http://localhost:3000/integrations');

    } catch (error) {
        console.error("❌ Basecamp Callback Error:", error.message || error.response?.data);
        res.status(500).json({
            error: "Failed to complete Basecamp authentication.",
            details: error.message || error.response?.data
        });
    }
});

// 🌟 NEW: Fetch Basecamp Projects for the Mapping Dropdown
app.get('/api/admin/basecamp-projects', async (req, res) => {
    try {
        // 1. Find the Basecamp integration in the database
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('provider', 'basecamp')
            .single();

        if (intError || !integration || !integration.secret_id) {
            return res.json({ isConnected: false, projects: [] });
        }

        // 2. Decrypt the Vault Secret
        const { data: decryptedJson, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !decryptedJson) {
            return res.json({ isConnected: false, projects: [] });
        }

        // Parse the JSON object we saved during the OAuth dance
        const { accountId, accessToken } = JSON.parse(decryptedJson);

        // 3. Call the Basecamp API using the decrypted token
        const response = await axios.get(`https://3.basecampapi.com/${accountId}/projects.json`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'TRON-V3-Engine (obhogate48@gmail.com)' // Ensure this matches your email
            }
        });

        // 4. Map the response to just the ID and Name for the frontend dropdown
        const projects = response.data.map(proj => ({
            id: proj.id.toString(),
            name: proj.name
        }));

        res.json({ isConnected: true, projects });

    } catch (error) {
        console.error("❌ Basecamp Projects Fetch Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch Basecamp projects." });
    }
});

// 🌟 NEW: Fetch dynamically connected Basecamp boards from the database
app.get('/api/admin/basecamp-boards', async (req, res) => {
    try {
        // Query Supabase for all repositories that use Basecamp
        const { data, error } = await supabase
            .from('repositories')
            .select('repo_name, pm_project_id')
            .eq('pm_provider', 'basecamp');

        if (error) throw error;

        // Format the data for the frontend
        // We use a Set to remove duplicates just in case multiple repos point to the same board
        const uniqueBoardsMap = new Map();
        
        data.forEach(row => {
            if (row.pm_project_id) {
                // If multiple repos share a board, we append the repo names
                if (uniqueBoardsMap.has(row.pm_project_id)) {
                    const existing = uniqueBoardsMap.get(row.pm_project_id);
                    existing.repos.push(row.repo_name);
                } else {
                    uniqueBoardsMap.set(row.pm_project_id, {
                        id: row.pm_project_id,
                        repos: [row.repo_name]
                    });
                }
            }
        });

        const formattedBoards = Array.from(uniqueBoardsMap.values()).map(board => ({
            id: board.id,
            name: `Linked to: ${board.repos.join(', ')}` // Dynamically name it based on the repo!
        }));

        res.json({ boards: formattedBoards });
    } catch (error) {
        console.error("❌ Failed to fetch Basecamp boards:", error);
        res.status(500).json({ error: "Database query failed." });
    }
});
    // 🌟 IN-MEMORY CACHE: Prevent Discord Rate Limits
let cachedDiscordChannels = null;
let lastDiscordFetch = 0;

// Global Discord Status Fetcher
app.get('/api/admin/discord-status', async (req, res) => {
    try {
        // 1. Fetch the Discord secret_id
        const { data: integration, error: intError } = await supabase
            .from('integrations') 
            .select('secret_id')
            .eq('provider', 'discord')
            .single();

        if (intError || !integration || !integration.secret_id) {
            return res.json({ isConnected: false });
        }

        // 2. Use an RPC call to decrypt
        const { data: botToken, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !botToken) {
            return res.json({ isConnected: false });
        }

        // 🌟 3. CACHE CHECK: If we fetched less than 60 seconds ago, use the cache!
        if (cachedDiscordChannels && (Date.now() - lastDiscordFetch < 60000)) {
            console.log("⚡ Serving Discord channels from TRON cache!");
            return res.json({ isConnected: true, channels: cachedDiscordChannels });
        }

        // 4. Ask Discord which servers (guilds) this bot is inside
        const guildResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bot ${botToken}` }
        });

        const guilds = guildResponse.data;
        if (guilds.length === 0) {
            return res.json({ isConnected: true, channels: [] }); 
        }

        // 5. Grab the text channels from the first server the bot is in
        const guildId = guilds[0].id;
        const channelResponse = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` }
        });

        // 6. Filter for standard text channels (type 0)
        const textChannels = channelResponse.data
            .filter(channel => channel.type === 0)
            .map(channel => ({
                id: channel.id,
                name: channel.name
            }));

        // 🌟 7. SAVE TO CACHE for the next 60 seconds
        cachedDiscordChannels = textChannels;
        lastDiscordFetch = Date.now();

        res.json({ 
            isConnected: true, 
            channels: textChannels 
        });

    } catch (error) {
        // If we hit a rate limit, gracefully return the cache if we have it!
        if (error.response?.status === 429 && cachedDiscordChannels) {
            console.log("⚠️ Discord rate limited us, falling back to cache.");
            return res.json({ isConnected: true, channels: cachedDiscordChannels });
        }
        
        console.error("❌ Discord Status Error:", error.response?.data || error.message);
        res.json({ isConnected: false }); 
    }
});

// 2. Save Discord Webhook/Bot Token
// (Your frontend uses a specific route name for Discord, so we catch it here!)
app.post('/api/admin/discord-token', async (req, res) => {
    const { token, orgId } = req.body;

    if (!token || !orgId) return res.status(400).json({ error: "Missing token or orgId" });

    // We can just reuse the exact same logic, hardcoding the provider as 'discord'
    try {
        console.log(`👉 Saving discord token for Org: ${orgId}`);

        const { data: secretId, error: vaultError } = await supabase.rpc('insert_secret', {
            secret_name: `discord_token_${orgId}_${Date.now()}`,
            secret_description: `Webhook/Bot token for Discord`,
            secret_value: token
        });

        if (vaultError || !secretId) throw new Error(`Vault Error: ${vaultError?.message}`);

        const { error: dbError } = await supabase
            .from('integrations')
            .upsert({ 
                org_id: orgId,
                provider: 'discord', 
                secret_id: secretId 
            }, { onConflict: 'org_id, provider' });

        if (dbError) throw new Error(`DB Error: ${dbError.message}`);

        res.json({ success: true, message: "Discord connected successfully!" });

    } catch (error) {
        console.error("❌ Discord Save Error:", error.message);
        res.status(500).json({ error: "Failed to save Discord integration." });
    }
});

// 4. Delete Discord
app.delete('/api/admin/discord-token', async (req, res) => {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "Missing orgId" });

    try {
        console.log(`🗑️ Disconnecting discord for Org: ${orgId}`);
        await supabase.from('integrations').delete().eq('provider', 'discord').eq('org_id', orgId);
        res.json({ success: true, message: "Discord disconnected." });
    } catch (error) {
        console.error("❌ Discord Disconnect Error:", error.message);
        res.status(500).json({ error: "Failed to disconnect Discord." });
    }
});

// 🌟 PRODUCTION EDITION (BULLETPROOF): Fetch Real Basecamp Columns
app.post('/api/admin/basecamp-columns', async (req, res) => {
    let { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: "Project ID is required." });
    }

    try {
        // 1. SMART CLEANUP: In case you pasted a full URL or it has spaces, just extract the digits!
        projectId = projectId.toString().match(/\d+/g)?.pop() || projectId.trim();

        // 2. Fetch the encrypted Basecamp token
        const { data: integration, error: intError } = await supabase
            .from('integrations') 
            .select('secret_id')
            .eq('provider', 'basecamp')
            .single();

        if (intError || !integration) {
            return res.status(400).json({ error: "Basecamp is not connected globally." });
        }

        const { data: decryptedJson, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !decryptedJson) throw new Error("Failed to decrypt Basecamp token");

        // 🌟 THE FIX: Parse the JSON to get the real token AND dynamically get the account ID!
        const { accountId, accessToken } = JSON.parse(decryptedJson);

        const basecampHeaders = {
            'Authorization': `Bearer ${accessToken}`, // Now we are sending just the clean token!
            'User-Agent': 'TRON-V3-Engine (obhogate48@gmail.com)', // ⚠️ UPDATE THIS EMAIL
            'Accept': 'application/json' 
        };

        // 3. Check Project Link
        const projectUrl = `https://3.basecampapi.com/${accountId}/buckets/${projectId}.json`;
        console.log("👉 1. Fetching Project:", projectUrl);
        const projectRes = await axios.get(projectUrl, { headers: basecampHeaders });

        // 4. Look through the project "dock" to find the kanban_board
        console.log("🛠️ Available tools:", projectRes.data.dock.map(t => t.name).join(', '));
        const kanbanTool = projectRes.data.dock.find(tool => tool.name === 'kanban_board');
        
        if (!kanbanTool || !kanbanTool.url) {
            return res.status(404).json({ error: "Kanban Board not found in this project." });
        }

        // 5. Fetch the Kanban Board directly
        console.log("👉 2. Fetching Kanban Board:", kanbanTool.url);
        const kanbanRes = await axios.get(kanbanTool.url, { headers: basecampHeaders });
        
        // 6. Extract the columns smartly!
        let lists = kanbanRes.data.lists || kanbanRes.data.columns; 
        
        if (!lists && kanbanRes.data.lists_url) {
            console.log("👉 3. Following lists_url:", kanbanRes.data.lists_url);
            const listsRes = await axios.get(kanbanRes.data.lists_url, { headers: basecampHeaders });
            lists = listsRes.data;
        }

        if (!lists) {
            console.log("❌ Kanban Response Dump:", Object.keys(kanbanRes.data));
            throw new Error("Found the Kanban Board, but couldn't locate the columns.");
        }

        // 7. Format the data for our Next.js frontend dropdowns
        const realColumns = lists.map(list => ({
            id: list.id.toString(), 
            name: list.title || list.name 
        }));

        console.log("✅ Success! Found columns:", realColumns.map(c => c.name).join(', '));
        res.json({ columns: realColumns });

    } catch (error) {
        console.error("❌ Basecamp API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to communicate with Basecamp API." });
    }
});
// 🌟 NEW: Fetch Active Workflows for Dashboard
app.get('/api/admin/dashboard-workflows', async (req, res) => {
    try {
        // Fetch all mapped repositories
        const { data: workflows, error } = await supabase
            .from('repositories') // ⚠️ Change this if your table is named differently!
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ workflows: workflows || [] });
    } catch (error) {
        console.error("❌ Failed to fetch dashboard workflows:", error.message);
        res.status(500).json({ error: "Failed to fetch workflows." });
    }
});

app.listen(port, () => {
    console.log(`\n🌐 T.R.O.N. V3 Cloud Router listening at http://localhost:${port}`);
});

// 🛡️ THE FREE TIER HACK: Run the worker in the same process!
console.log('🚀 Booting up the integrated Background Worker...');
require('./worker');