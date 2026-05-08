require('dotenv').config();
const Redis = require('ioredis');
const { supabase } = require('../config/supabase.js');
const PMOrchestrator = require('./adapters/pm-orchestrator');
const githubAdapter = require('./adapters/github'); 
const aiAdapter = require('./adapters/ai');
const messengerAdapter = require('./adapters/messenger');
const redis = require('./config/redis');
const { getRepoConfigFromDB } = require('./config/db.js');

redis.on('connect', () => console.log('✅ [Redis] Worker connected successfully.'));
redis.on('error', (err) => console.error('❌ [Redis] Connection Error:', err.message));

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

            const job = JSON.parse(jobString);
            const repoName = job.payload.repository?.full_name;
            
            if (!repoName) continue;

            const projectConfig = await getRepoConfigFromDB(repoName);
            if (!projectConfig) continue;

            // --- EVENT: PULL REQUEST ---
            if (job.eventType === 'pull_request') {
                const prTitle = job.payload.pull_request.title;
                const branchName = job.payload.pull_request.head.ref || "";
                const action = job.payload.action; 

                let taskIdentifier = null;
                const branchMatch = branchName.match(/(\d{9,}|[A-Z]+-\d+)/); 
                const titleMatch = prTitle.match(/(\d{9,}|[A-Z]+-\d+)/);

                if (branchMatch) taskIdentifier = branchMatch[1];
                else if (titleMatch) taskIdentifier = titleMatch[1];

                const pmTool = {
                    ...projectConfig.pm_tool,
                    project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                };

                const mappingKey = `pull_request_${action}`; 
                const newStatus = projectConfig.mapping[mappingKey];

                if (newStatus && taskIdentifier && pmTool && pmTool.provider !== "none") {
                    try {
                        // 🌟 FIX: Passed projectConfig.org_id here
                        await PMOrchestrator.updateTicketStatus(pmTool, taskIdentifier, newStatus, projectConfig.org_id);
                        console.log(`✅ [PM] Moved ticket [${taskIdentifier}] to ${newStatus}`);
                    } catch (error) {
                        console.error(`⚠️ [PM] Failed to move ticket:`, error.message);
                    }
                }

                if (action === 'opened' || action === 'reopened') {
                    if (job.payload.pull_request.draft) continue; 

                    const diffUrl = job.payload.pull_request.diff_url;
                    const repoFullName = job.payload.repository.full_name; 
                    const prNumber = job.payload.pull_request.number;

                    try {
                        const sanitizedDiff = await githubAdapter.fetchAndSanitizeDiff(diffUrl);
                        const codeReview = await aiAdapter.generateCodeReview(sanitizedDiff);
                        
                        if (taskIdentifier) {
                            await redis.set(`ai_review:${taskIdentifier}`, codeReview, 'EX', 604800);
                        }
                        
                        const commentHeader = `### 🤖 T.R.O.N. Automated Code Review\n\n`;
                        await githubAdapter.postPullRequestComment(repoFullName, prNumber, commentHeader + codeReview);
                        console.log(`💬 [GitHub] Posted Code Review to PR #${prNumber}`);

                        const intelligenceReport = await aiAdapter.generateExecutiveSummary(prTitle, sanitizedDiff);
                        const prUrl = job.payload.pull_request.html_url;
                        
                        if (projectConfig.communication) {
                            // 🌟 FIX: Passed projectConfig.org_id here for Discord
                            await messengerAdapter.broadcastSummary(projectConfig.communication, prTitle, prUrl, intelligenceReport, projectConfig.org_id);
                            console.log(`✅ [Messenger] Broadcasted AI Intel to communication channel.`);
                        }
                    } catch (aiError) {
                        console.error(`❌ [AI] Pipeline failed:`, aiError.message);
                    }
                }

            // --- EVENT: LOCAL DAEMON TASK START ---
            } else if (job.eventType === 'local_start') {
                const taskID = job.payload.taskId;
                const pmTool = {
                    ...projectConfig.pm_tool,
                    project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                };
                const newStatus = projectConfig.mapping['branch_created']; 

                if (!newStatus) continue;

                try {
                    // 🌟 FIX: Passed projectConfig.org_id here
                    await PMOrchestrator.updateTicketStatus(pmTool, taskID, newStatus, projectConfig.org_id);
                    console.log(`✅ [PM] Moved ticket [${taskID}] to branch_created status.`); 
                } catch (error) {
                    console.error(`❌ [PM] Failed to update status:`, error.message);
                    job.retryCount = (job.retryCount || 0) + 1;
                    
                    if (job.retryCount <= 3) {
                        const backoffTime = Math.pow(2, job.retryCount) * 1000;
                        await sleep(backoffTime);
                        await redis.lpush('tron:v3_secret_queue', JSON.stringify(job)); 
                    } else {
                        await redis.lpush('tron:dead_letters', jobString);
                    }
                }

            // --- EVENT: GITHUB PUSH / BRANCH CREATED ---
            } else if (job.eventType === 'push' || job.eventType === 'create') {
                const ref = job.payload.ref || "";
                
                if (job.payload.deleted) continue; 
                if (job.eventType === 'push' && !ref.startsWith('refs/heads/')) continue;

                const branchName = ref.replace('refs/heads/', '');
                const taskIdMatch = branchName.match(/(\d{9,}|[A-Z]+-\d+)/); 

                if (taskIdMatch) {
                    const taskIdentifier = taskIdMatch[1];
                    const pmTool = {
                        ...projectConfig.pm_tool,
                        project_id: projectConfig.pm_tool?.board_id || projectConfig.pm_tool?.project_id || projectConfig.pm_project_id
                    };
                    const newStatus = projectConfig.mapping['branch_created']; 

                    if (newStatus && pmTool && pmTool.provider !== "none") {
                        try {
                            // 🌟 FIX: Passed projectConfig.org_id here
                            await PMOrchestrator.updateTicketStatus(pmTool, taskIdentifier, newStatus, projectConfig.org_id);
                            console.log(`✅ [PM] Moved ticket [${taskIdentifier}] on branch creation.`);
                        } catch (error) {
                            console.error(`⚠️ [PM] Failed to move ticket:`, error.message);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Critical Worker Error:', error);
            await sleep(5000); 
        }
    }
}

redis.once('ready', () => {
    startWorker();
});

process.on('SIGTERM', async () => {
    await redis.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await redis.quit();
    process.exit(0);
});