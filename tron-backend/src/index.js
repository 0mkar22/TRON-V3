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

// 🌟 NEW: Fetch Tickets for Go Daemon
app.get('/api/project/:encodedRepo/tickets', async (req, res) => {
    const repo = decodeURIComponent(req.params.encodedRepo);
    
    try {
        const config = await getRepoConfigFromDB(repo);
        if (!config || config.pm_tool.provider === "none") {
            return res.json({ tickets: [] });
        }

        const activeTickets = await PMOrchestrator.getTickets(config.pm_tool, config.mapping);
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

// 🌟 UPDATED: Mission Control - Fetch Redis Queue & AI Reviews (With Full Details)
app.get('/api/admin/system-status', async (req, res) => {
    try {
        // 1. Fetch the Active Webhook Queue
        const queueItems = await redis.lrange('tron:v3_secret_queue', 0, -1);
        const parsedQueue = queueItems.map(item => JSON.parse(item));

        // 2. Fetch AI Review History Keys
        const reviewKeys = await redis.keys('ai_review:*');
        const reviews = [];

        // 🌟 UPDATED: We now fetch the full data payload for the frontend modal!
        for (const key of reviewKeys) {
            const dataString = await redis.get(key);
            
            if (dataString) {
                const data = JSON.parse(dataString);
                const taskId = key.split(':')[1];
                
                reviews.push({ 
                    taskId: taskId, 
                    key: key,
                    details: data // <-- This is what feeds the new UI modal!
                });
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

// 🌟 DYNAMIC EDITION: Save Discord Token to Vault 
app.post('/api/admin/discord-token', async (req, res) => {
    const { token } = req.body; // Notice: We don't ask the frontend for the orgId anymore!

    if (!token) {
        return res.status(400).json({ error: "Missing Discord token." });
    }

    try {
        // 1. Dynamically fetch the master org_id from your existing GitHub connection
        const { data: masterOrg, error: orgError } = await supabase
            .from('integrations')
            .select('org_id')
            .eq('provider', 'github')
            .single();

        if (orgError || !masterOrg || !masterOrg.org_id) {
            return res.status(400).json({ error: "Could not find a primary Organization ID. Please link GitHub first." });
        }

        const dynamicOrgId = masterOrg.org_id;

        // 2. Call the Supabase SQL function using the dynamically found ID
        const { error: vaultError } = await supabase.rpc('add_discord_integration', {
            p_org_id: dynamicOrgId,
            p_token: token
        });

        if (vaultError) throw vaultError;

        res.json({ message: "Discord successfully connected and vaulted!" });
    } catch (error) {
        console.error("❌ Failed to save Discord token:", error.message);
        res.status(500).json({ error: "Failed to securely store integration." });
    }
});

// 🌟 NEW: Disconnect Discord
app.delete('/api/admin/discord-token', async (req, res) => {
    try {
        // Delete the discord row from the integrations table
        const { error } = await supabase
            .from('integrations')
            .delete()
            .eq('provider', 'discord');

        if (error) throw error;
        res.json({ message: "Disconnected successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to disconnect" });
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
        
        let accountId = process.env.BASECAMP_ACCOUNT_ID || 'YOUR_ACCOUNT_ID_HERE'; 
        accountId = accountId.toString().match(/\d+/g)?.pop() || accountId.trim();

        // 2. Fetch the encrypted Basecamp token
        const { data: integration, error: intError } = await supabase
            .from('integrations') 
            .select('secret_id')
            .eq('provider', 'basecamp')
            .single();

        if (intError || !integration) {
            return res.status(400).json({ error: "Basecamp is not connected globally." });
        }

        const { data: bcToken, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !bcToken) throw new Error("Failed to decrypt Basecamp token");

        const basecampHeaders = {
            'Authorization': `Bearer ${bcToken}`,
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
        // It will check if they are embedded, OR if there is a lists_url we need to follow.
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
            name: list.title || list.name // Handles both naming conventions
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