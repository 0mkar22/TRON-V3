require('dotenv').config();
const Redis = require('ioredis');
const { supabase } = require('./config/supabase.js');
const PMOrchestrator = require('./adapters/pm-orchestrator');
const githubAdapter = require('./adapters/github'); 
const aiAdapter = require('./adapters/ai');
const messengerAdapter = require('./adapters/messenger');
const redis = require('./config/redis');
const { getRepoConfigFromDB } = require('./config/db.js');

// 🛡️ THE FIX: Smart connection that won't freeze silently
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isSecure = redisUrl.startsWith('rediss://'); 


// Add logs so we can physically see the worker connect!
redis.on('connect', () => console.log('✅ [Worker] Successfully connected to Redis!'));
redis.on('error', (err) => console.error('❌ [Worker] Redis Connection Error:', err.message));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('👷 T.R.O.N. V3 Background Worker Booting Up...');

async function startWorker() {
    console.log('🎧 Worker is actively listening to the Redis Queue...');

    while (true) {
        try {
            const jobString = await redis.rpop('tron:v3_secret_queue');
            
            if (!jobString) {
                await sleep(1500);
                continue;
            }

            console.log(`\n🔥 [WORKER] DATA FOUND!`);
            const job = JSON.parse(jobString);

            console.log(`⚙️  Processing Delivery ID: [${job.deliveryId}]`);

            // 3. Extract repo name
            const repoName = job.payload.repository?.full_name;
            if (!repoName) {
                console.log('⏭️  Skipping: Payload does not contain a repository name.');
                continue;
            }

            // 🧠 THE FIX: Asynchronously fetch the config from Supabase!
            // 🌟 Here is our true variable name: projectConfig
            const projectConfig = await getRepoConfigFromDB(repoName);
            
            if (!projectConfig) {
                console.log(`⏭️  Skipping: No configuration found in Database for repo "${repoName}"`);
                continue;
            }

            // ==========================================
            // EVENT: PULL REQUEST
            // ==========================================
            if (job.eventType === 'pull_request') {
                const prTitle = job.payload.pull_request.title;
                const branchName = job.payload.pull_request.head.ref || "";
                const action = job.payload.action; 
                
                console.log(`\n🔀 [PR EVENT] Action: ${action} | Title: "${prTitle}"`);

                let taskIdentifier = null;
                const branchMatch = branchName.match(/(\d{9,}|[A-Z]+-\d+)/); 
                const titleMatch = prTitle.match(/(\d{9,}|[A-Z]+-\d+)/);

                if (branchMatch) {
                    taskIdentifier = branchMatch[1];
                    console.log(`🎯 Extracted Task ID [${taskIdentifier}] from PR branch name.`);
                } else if (titleMatch) {
                    taskIdentifier = titleMatch[1];
                    console.log(`🎯 Extracted Task ID [${taskIdentifier}] from PR title.`);
                }

                // --- PHASE 1: PM STATE TRACKING ---
                const pmTool = {
                    ...projectConfig.pm_tool,
                    project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                };

                const mappingKey = `pull_request_${action}`; 
                const newStatus = projectConfig.mapping[mappingKey];

                if (!newStatus) {
                    console.log(`⏭️  Skipping PM update: No mapping found in DB for "${mappingKey}"`);
                } else if (taskIdentifier && pmTool && pmTool.provider !== "none") {
                    try {
                        console.log(`🚚 Moving ticket [${taskIdentifier}] to column ${newStatus} in ${pmTool.provider}...`);
                        await PMOrchestrator.updateTicketStatus(pmTool, taskIdentifier, newStatus);
                        console.log(`✅ Successfully moved ticket for PR ${action}!`);
                    } catch (error) {
                        console.error(`⚠️ Failed to move PM ticket:`, error.message);
                    }
                }

                // --- PHASE 2: AI PIPELINE (DIFF SANITIZER & SUMMARIZATION) ---
                if (action === 'opened' || action === 'reopened') {
                    if (job.payload.pull_request.draft === true) {
                        console.log(`⏭️  [AI PIPELINE] Skipping Draft PR: "${prTitle}"`);
                        continue; 
                    }

                    const diffUrl = job.payload.pull_request.diff_url;
                    const repoFullName = job.payload.repository.full_name; 
                    const prNumber = job.payload.pull_request.number;

                    console.log(`\n🧠 [AI PIPELINE] Generating Intel & Code Review for: "${prTitle}"`);
                    
                    try {
                        const sanitizedDiff = await githubAdapter.fetchAndSanitizeDiff(diffUrl);
                        
                        console.log(`🕵️‍♂️ Analyzing diff for bugs...`);
                        const codeReview = await aiAdapter.generateCodeReview(sanitizedDiff);
                        
                        // Store the review in Redis for 7 days (604800 seconds)
                        if (taskIdentifier) {
                            await redis.set(`ai_review:${taskIdentifier}`, codeReview, 'EX', 604800);
                            console.log(`💾 Saved AI Code Review to Redis for Task [${taskIdentifier}]`);
                        }
                        
                        console.log(`💬 Posting Code Review to GitHub PR #${prNumber}...`);
                        const commentHeader = `### 🤖 T.R.O.N. Automated Code Review\n\n`;
                        await githubAdapter.postPullRequestComment(repoFullName, prNumber, commentHeader + codeReview);

                        const intelligenceReport = await aiAdapter.generateExecutiveSummary(prTitle, sanitizedDiff);
                        
                        console.log(`\n📊 --- FINAL EXECUTIVE REPORT ---`);
                        console.log(`🏷️  Category: ${intelligenceReport.intent}`);
                        console.log(`📝 Summary:  ${intelligenceReport.executive_summary}`);
                        console.log(`🚀 Impact:   ${intelligenceReport.business_impact}`);
                        console.log(`--------------------------------\n`);

                        const prUrl = job.payload.pull_request.html_url;

                        if (projectConfig.communication) {
                            await messengerAdapter.broadcastSummary(projectConfig.communication, prTitle, prUrl, intelligenceReport);
                        } else {
                            console.log(`⚠️ No communication config found in DB. Skipping broadcast.`);
                        }

                    } catch (aiError) {
                        console.error(`❌ [AI PIPELINE] Pipeline failed:`, aiError.message);
                    }
                }

            // ==========================================
            // EVENT: LOCAL DAEMON TASK START
            // ==========================================
            } else if (job.eventType === 'local_start') {
                const taskID = job.payload.taskId;
                
                const pmTool = {
                    ...projectConfig.pm_tool,
                    project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                };
                
                const newStatus = projectConfig.mapping['branch_created']; 

                if (!newStatus) {
                    console.log(`⏭️  Skipping: No 'branch_created' mapping found in DB`);
                    continue;
                }

                try {
                    console.log(`🚚 Moving ticket [${taskID}] to ${newStatus}...`);
                    await PMOrchestrator.updateTicketStatus(pmTool, taskID, newStatus);
                    console.log(`✅ Successfully moved ticket [${taskID}]!`); 
                } 
                catch (error){
                    console.error(`❌ [ORCHESTRATOR] Failed to update status:`, error.message);
                    
                    job.retryCount = (job.retryCount || 0) + 1;
                    
                    if (job.retryCount <= 3) {
                        const backoffTime = Math.pow(2, job.retryCount) * 1000;
                        console.log(`⏳ API Overloaded. Applying backoff. Waiting ${backoffTime}ms...`);
                        await sleep(backoffTime);
                        await redis.lpush('tron:v3_secret_queue', JSON.stringify(job)); // FIXED QUEUE NAME
                    } else {
                        console.error(`💀 Job permanently failed. Moving to Dead Letter Queue.`);
                        await redis.lpush('tron:dead_letters', jobString);
                    }
                    continue; 
                }

            // ==========================================
            // EVENT: GITHUB PUSH / BRANCH CREATED
            // ==========================================
            } else if (job.eventType === 'push' || job.eventType === 'create') {
                const ref = job.payload.ref || "";
                
                if (job.payload.deleted === true) {
                    console.log(`🗑️  [BRANCH EVENT] Branch deleted. Ignoring to prevent ticket rewind.`);
                    continue; 
                }

                if (job.eventType === 'push' && !ref.startsWith('refs/heads/')) {
                    console.log(`⏭️  Skipping non-branch push: ${ref}`);
                } else {
                    const branchName = ref.replace('refs/heads/', '');
                    console.log(`\n🌿 [BRANCH EVENT] Detected branch: "${branchName}"`);

                    const taskIdMatch = branchName.match(/(\d{9,}|[A-Z]+-\d+)/); 

                    if (taskIdMatch) {
                        const taskIdentifier = taskIdMatch[1];
                        console.log(`🎯 Extracted Task ID [${taskIdentifier}] from branch name.`);

                        const pmTool = {
                            ...projectConfig.pm_tool,
                            project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                        };
                        const newStatus = projectConfig.mapping['branch_created']; 

                        if (!newStatus) {
                            console.log(`⏭️  Skipping: No 'branch_created' mapping found in DB`);
                        } else if (pmTool && pmTool.provider !== "none") {
                            try {
                                console.log(`🚚 Moving ticket [${taskIdentifier}] to ${newStatus}...`);
                                await PMOrchestrator.updateTicketStatus(pmTool, taskIdentifier, newStatus);
                                console.log(`✅ Successfully moved ticket!`);
                            } catch (error) {
                                console.error(`⚠️ Failed to move PM ticket:`, error.message);
                            }
                        }
                    } else {
                        console.log(`⚠️  No valid Task ID found in branch name "${branchName}". Cannot move PM card.`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Critical Worker Error:', error);
            await sleep(5000); // Prevent tight loop crashing
        }
    }
}

// Wait for the secure SSL connection to finish before pulling jobs
redis.once('ready', () => {
    startWorker();
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received. Shutting down worker gracefully...');
    await redis.quit();
    console.log('💤 Disconnected from Redis. Exiting process.');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received. Shutting down worker gracefully...');
    await redis.quit();
    console.log('💤 Disconnected from Redis. Exiting process.');
    process.exit(0);
});