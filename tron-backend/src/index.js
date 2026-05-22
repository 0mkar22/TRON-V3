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

let connectedClients = [];

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

// 🌟 SECURED: "Silent" route to create a ticket without starting a branch
app.post('/api/create-task', requireAuth, async (req, res) => {
    const { taskInput, repoName } = req.body;
    
    try {
        const config = await getRepoConfigFromDB(repoName);

        // 🌟 THE FIX: Check 'pm_provider' instead of the nested 'pm_tool'
        if (!config || !config.pm_provider || config.pm_provider === "none") {
             return res.status(400).json({ error: "No PM tool configured in database." });
        }

        const orgId = req.user?.org_id || req.user?.user_metadata?.org_id;

        // 🌟 THE FIX: Pass the raw 'config' object
        const newTaskId = await PMOrchestrator.resolveTask(config, taskInput, config.mapping, orgId);
        res.json({ resolvedId: newTaskId });
    } catch (error) {
        console.error("Task creation failed:", error);
        res.status(500).json({ error: "Task creation failed." });
    }
});

// 🌟 SECURED: Start Task, Move Column & Assign
app.post('/api/start-task', requireAuth, async (req, res) => {
    const { taskInput, repoName, developer } = req.body;
    
    try {
        const config = await getRepoConfigFromDB(repoName);
        let resolvedTaskID = taskInput.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(); 

        // 🌟 THE FIX: Check 'pm_provider'
        if (config && config.pm_provider && config.pm_provider !== "none") {
            const orgId = req.user?.org_id || req.user?.user_metadata?.org_id;

            resolvedTaskID = await PMOrchestrator.resolveTask(config, taskInput, config.mapping, orgId);
            
            const inProgressId = config.mapping.branch_created || config.mapping.in_progress;
            
            if (inProgressId) {
                console.log(`🚚 [API] Moving task [${resolvedTaskID}] to In Progress column...`);
                await PMOrchestrator.updateTicketStatus(config, resolvedTaskID, inProgressId, orgId);
            }

            if (developer) {
                console.log(`👤 [API] Attempting to assign developer: ${developer}`);
                await PMOrchestrator.assignTicket(config, resolvedTaskID, developer, orgId);
            }
            
            await redis.lpush('tron:webhook_queue', JSON.stringify({
                eventType: 'local_start',
                payload: { taskId: resolvedTaskID, repository: { full_name: repoName } }
            }));
        }

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
        
        // 🌟 THE FIX: Check 'pm_provider'
        if (!config || !config.pm_provider || config.pm_provider === "none") {
            return res.json({ isMapped: false, tickets: [] });
        }

        const orgId = req.user?.org_id || req.user?.user_metadata?.org_id;

        // 🌟 THE FIX: Pass the raw 'config' object
        const activeTickets = await PMOrchestrator.getTickets(config, config.mapping, orgId);
        res.json({ isMapped: true, tickets: activeTickets }); 
    } catch (error) {
        console.error("❌ Failed to fetch tickets:", error.message);
        res.status(500).json({ error: "Failed to fetch tickets." });
    }
});


// ==========================================
// AI & WEBHOOK QUEUE
// ==========================================

// 🌟 SECURED: AI TASK SUGGESTIONS API
app.post('/api/suggest-tasks', requireAuth, async (req, res) => {
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

    // Permit installation events (GitHub App) alongside pull_requests
    if (eventType === 'pull_request') {
        const action = payload.action;
        if (!['opened', 'closed', 'reopened'].includes(action)) return;
    } else if (eventType !== 'installation') {
        // Discard unnecessary events to save queue processing time
        return;
    }

    console.log(`\n📥 Received Valid GitHub Event: [${eventType}] | Delivery ID: [${deliveryId}]`);

    const queueJob = { deliveryId, eventType, payload };
    await redis.lpush('tron:v3_secret_queue', JSON.stringify(queueJob));

    console.log(`📤 Successfully pushed Delivery ID: [${deliveryId}] to Redis!`);
});

// 🌟 UPDATED: Link a GitHub Repository to a PM Tool & Save Comm Config
app.post('/api/repositories', async (req, res) => {
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
                communication_config: communication_config
            }], { onConflict: 'repo_name' }); 

        if (error) throw error;
        
        res.status(200).json({ message: "Repository linked successfully." });
    } catch (error) {
        console.error("❌ Failed to save repository config:", error.message);
        res.status(500).json({ error: "Failed to save repository configuration." });
    }
});

// 🌟 FETCH AI REVIEW FOR VS CODE
app.get('/api/review/:taskId', requireAuth, async (req, res) => {
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
// DASHBOARD & ADMIN AUTH ROUTES
// ==========================================

// 🌟 Start the Basecamp OAuth Dance
app.post('/api/auth/basecamp/init', async (req, res) => {
    const { accountId, clientId, clientSecret, orgId } = req.body;

    if (!accountId || !clientId || !clientSecret || !orgId) {
        return res.status(400).json({ error: "Missing Basecamp credentials or Org ID." });
    }

    try {
        console.log(`👉 Starting Basecamp auth for Org: ${orgId}`);

        const pendingData = JSON.stringify({ accountId, clientId, clientSecret });

        const { data: secretId, error: vaultError } = await supabase.rpc('insert_secret', {
            secret_name: `basecamp_pending_${orgId}_${Date.now()}`,
            secret_description: `Pending OAuth keys for Basecamp`,
            secret_value: pendingData
        });

        if (vaultError) throw new Error(`Vault Error: ${vaultError.message}`);
        if (!secretId) throw new Error(`Vault Error: No secret_id returned`);

        const { error: dbError } = await supabase
            .from('integrations')
            .upsert({ 
                org_id: orgId,
                provider: 'basecamp_pending', 
                secret_id: secretId
            }, { onConflict: 'org_id, provider' });

        if (dbError) throw new Error(`DB Error: ${dbError.message}`);

        const redirectUri = encodeURIComponent("https://tron-v3.onrender.com/api/auth/basecamp/callback");
        const stateParam = encodeURIComponent(orgId); 
        const authUrl = `https://launchpad.37signals.com/authorization/new?type=web_server&client_id=${clientId}&redirect_uri=${redirectUri}&state=${stateParam}`;

        res.json({ success: true, redirectUrl: authUrl });

    } catch (error) {
        console.error("❌ Basecamp Init Error:", error.message);
        res.status(500).json({ 
            error: "Failed to initialize Basecamp auth.",
            details: error.message 
        });
    }
});

// 🌟 Catch the Basecamp OAuth Redirect
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

        const frontendUrl = process.env.FRONTEND_URL || 'https://tron-v3.vercel.app';
        res.redirect(`${frontendUrl}/integrations`);

    } catch (error) {
        console.error("❌ Basecamp Callback Error:", error.message || error.response?.data);
        res.status(500).json({
            error: "Failed to complete Basecamp authentication.",
            details: error.message || error.response?.data
        });
    }
});

app.listen(port, () => {
    console.log(`\n🌐 T.R.O.N. V3 Cloud Router listening at http://localhost:${port}`);
});

// ==========================================
// REAL-TIME LOG STREAMING WITH SSE
// ==========================================

app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.write(`data: ${JSON.stringify({
        id: 'connected',
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: 'System',
        message: 'Connected to TRON Live Stream...',
        color: 'text-emerald-500'
    })}\n\n`);

    connectedClients.push(res);

    req.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== res);
    });
});

const broadcastLog = (source, message, color = 'text-gray-300') => {
    const logEntry = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source,
        message,
        color
    };
    connectedClients.forEach(client => {
        client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    });
};

// 🛡️ THE FREE TIER HACK: Run the worker in the same process!
console.log('🚀 Booting up the integrated Background Worker...');
require('./worker');