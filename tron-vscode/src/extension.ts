import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TronProvider } from './tronProvider';
import { createSupabaseClient } from './supabaseClient';

const execAsync = promisify(exec);

// 🌟 Dynamically read backend URL from VS Code settings
const getConfig = () => vscode.workspace.getConfiguration('tron');
const getApiUrl = () => getConfig().get<string>('backendUrl') || 'https://tron-v3-1.onrender.com';

// 🌟 Using Webpack environment variables (fallback to hardcoded if not bundled properly)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kobhfwjnbmbtgcikeulp.supabase.co'; 
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYmhmd2puYm1idGdjaWtldWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzU3NzIsImV4cCI6MjA5MjQxMTc3Mn0.mopgJImaUiLfxCxSW-VSCcGkr4rUtEYvOrHJDMZsL4A'; 

// 24-Hour Expiry Constants
const LOGIN_EXPIRY_MS = 24 * 60 * 60 * 1000; 
const LOGIN_TIMESTAMP_KEY = 'tron.loginTimestamp';

interface TaskQuickPickItem extends vscode.QuickPickItem {
    taskId: string;
    rawTitle: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 [ACTIVATION] TRON extension is waking up...');
    console.log(`🐛 [CONFIG] Target Backend URL: ${getApiUrl()}`);

    // 1. Initialize Secure Supabase Client
    console.log('🔌 [AUTH] Initializing Supabase client...');
    const supabase = createSupabaseClient(context, SUPABASE_URL, SUPABASE_ANON_KEY);
    const tronProvider = new TronProvider(supabase);
    vscode.window.registerTreeDataProvider('tron-tickets', tronProvider);

    // 2. The 24-Hour Enforcer
    const enforceLoginExpiry = async () => {
        console.log('⏱️ [AUTH] Running background session check...');
        const loginTime = context.globalState.get<number>(LOGIN_TIMESTAMP_KEY);
        if (loginTime) {
            const timeElapsed = Date.now() - loginTime;
            if (timeElapsed > LOGIN_EXPIRY_MS) {
                console.log('🛑 [AUTH] 24-Hour Session Expired! Forcing logout.');
                await supabase.auth.signOut();
                await context.globalState.update(LOGIN_TIMESTAMP_KEY, undefined); 
                tronProvider.refresh(); 
                vscode.window.showWarningMessage('T.R.O.N: Session expired (24 hours). Please sign in again with your Developer ID.');
            }
        }
    };

    void enforceLoginExpiry(); 
    const expiryCheckInterval = setInterval(() => { void enforceLoginExpiry(); }, 5 * 60 * 1000); 
    context.subscriptions.push({ dispose: () => clearInterval(expiryCheckInterval as any) });

    // 3. Axios Interceptor: Attach Secure Token & Domain
    axios.interceptors.request.use(async (config) => {
        console.log(`🌐 [NETWORK-OUT] Intercepting request to: ${getApiUrl()}${config.url}`);
        await enforceLoginExpiry(); 
        const { data: { session } } = await supabase.auth.getSession();
        
        config.baseURL = getApiUrl();
        
        if (session?.access_token) {
            console.log('🔐 [NETWORK-OUT] Attaching active Supabase Bearer token.');
            config.headers.Authorization = `Bearer ${session.access_token}`;
        } else {
            console.log('⚠️ [NETWORK-OUT] WARNING: Firing request WITHOUT a session token!');
        }
        return config;
    });

    // Startup Welcome Message
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            console.log(`✅ [STARTUP] Found active session for: ${session.user.email}`);
            vscode.window.showInformationMessage(`T.R.O.N: Signed in as ${session.user.email}`);
        } else {
            console.log(`💤 [STARTUP] No active session found. User needs to log in.`);
        }
    });

    // --- AUTHENTICATION COMMANDS ---

    const signInCmd = vscode.commands.registerCommand('tron.signIn', async () => {
        console.log('🕹️ [CMD] tron.signIn triggered.');
        const email = await vscode.window.showInputBox({ prompt: 'Enter your Developer ID (Email)', placeHolder: 'dev@company.com' });
        if (!email) { console.log('❌ [CMD] Sign In aborted (No email).'); return; }
        
        const password = await vscode.window.showInputBox({ prompt: 'Enter your Password', password: true });
        if (!password) { console.log('❌ [CMD] Sign In aborted (No password).'); return; }

        console.log(`⏳ [AUTH] Attempting Supabase login for: ${email}`);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            console.log(`❌ [AUTH] Login failed: ${error.message}`);
            vscode.window.showErrorMessage(`T.R.O.N: Sign in failed — ${error.message}`);
        } else {
            console.log(`✅ [AUTH] Login successful! Updating timestamp.`);
            await context.globalState.update(LOGIN_TIMESTAMP_KEY, Date.now());
            vscode.window.showInformationMessage(`T.R.O.N: Signed in successfully as ${data.user.email}. Fetching your tickets...`);
            tronProvider.refresh();
        }
    });

    const signOutCmd = vscode.commands.registerCommand('tron.signOut', async () => {
        console.log('🕹️ [CMD] tron.signOut triggered.');
        await supabase.auth.signOut();
        await context.globalState.update(LOGIN_TIMESTAMP_KEY, undefined); 
        console.log('✅ [AUTH] Logged out & timestamp cleared.');
        vscode.window.showInformationMessage('T.R.O.N: Signed out.');
        tronProvider.refresh();
    });

    // --- WORKFLOW COMMANDS ---

    let refreshCmd = vscode.commands.registerCommand('tron.refreshTickets', () => {
        console.log('🕹️ [CMD] tron.refreshTickets triggered.');
        tronProvider.refresh();
        vscode.window.showInformationMessage('T.R.O.N: Tasks Refreshed');
    });

    let startTaskCmd = vscode.commands.registerCommand('tron.startTaskFromTree', async (task: any) => {
        console.log(`🕹️ [CMD] tron.startTaskFromTree triggered for Task ID: ${task?.id || task?.taskId}`);
        try {
            const taskId = task.id || task.taskId;
            if (!taskId){
            return;
            }

            const taskTitle = task.title || task.rawTitle || `Task ${taskId}`;

            const userChoice = await vscode.window.showWarningMessage(
                `Start working on "${taskTitle}"? \n\nThis will automatically stash your current work, create a new branch, and assign you on Basecamp.`,
                { modal: true }, 
                'Yes, Start Task'
            );

            if (userChoice !== 'Yes, Start Task') {
                console.log('❌ [WORKFLOW] User aborted branch creation.');
                return false;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders){
            return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            console.log(`🔍 [GIT] Inspecting local git repo at: ${cwd}`);
            let gitUsername = 'dev';
            try {
                const { stdout: userOut } = await execAsync('git config user.name', { cwd });
                gitUsername = userOut.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                console.log(`👤 [GIT] Found username: ${gitUsername}`);
            } catch (e) {
                console.log('⚠️ [GIT] Could not find git username, defaulting to "dev"');
            }

            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            const remoteUrl = stdout.trim();
            const repoMatch = remoteUrl.match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch) {
                console.log('❌ [GIT] Could not parse github remote URL.');
                return;
            }
            const repoName = repoMatch[1].replace('.git', '');
            console.log(`🔗 [GIT] Extracted Repo Name: ${repoName}`);

            vscode.window.showInformationMessage(`T.R.O.N: Syncing with Basecamp...`);

            let resolvedId = taskId;
            try {
                console.log(`📡 [NETWORK] Sending start-task payload to Go backend...`);
                // 🌟 FIX: Removed getApiUrl() from path
                const response = await axios.post(`/api/start-task`, {
                    taskInput: taskId,
                    repoName: repoName,
                    developer: gitUsername 
                });
                resolvedId = response.data.resolvedId; 
                console.log(`✅ [NETWORK] Basecamp sync successful. Resolved ID: ${resolvedId}`);
                vscode.window.showInformationMessage(`✅ T.R.O.N: Basecamp synchronized & assigned!`);
            } catch (apiError: any) {
                console.error(`❌ [NETWORK] Basecamp sync failed:`, apiError?.response?.data || apiError.message);
                vscode.window.showErrorMessage(`T.R.O.N Backend Error: Could not sync with Basecamp.`);
                return; 
            }

            const rawTitle = task.title || task.rawTitle || 'task';
            const formattedDesc = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);
            const branchName = `${gitUsername}/${resolvedId}-${formattedDesc}`;
            
            console.log(`🌿 [GIT] Target branch name: ${branchName}`);
            vscode.window.showInformationMessage(`T.R.O.N: Safely moving you to ${branchName}...`);

            let stashed = false;
            try {
                const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd });
                if (statusOut.trim().length > 0) {
                    console.log(`📦 [GIT] Uncommitted changes found. Stashing...`);
                    await execAsync('git stash push -m "TRON_AUTO_STASH"', { cwd });
                    stashed = true;
                }
            } catch (e) {
                console.log(`⚠️ [GIT] Stash check failed. Proceeding safely.`);
            }

            try {
                await execAsync(`git rev-parse --verify ${branchName}`, { cwd });
                console.log(`🌿 [GIT] Branch already exists. Checking out...`);
                await execAsync(`git checkout ${branchName}`, { cwd });
                vscode.window.showInformationMessage(`✅ T.R.O.N: Resumed existing branch ${branchName}`);
            } catch (err) {
                console.log(`🌿 [GIT] Branch does not exist. Creating new branch...`);
                await execAsync(`git checkout -b ${branchName}`, { cwd });
                console.log(`📤 [GIT] Pushing new branch to origin...`);
                await execAsync(`git push -u origin ${branchName}`, { cwd });
                vscode.window.showInformationMessage(`✅ T.R.O.N: Created and pushed new branch! Basecamp will auto-assign shortly.`);
            }

            if (stashed) {
                try {
                    console.log(`📦 [GIT] Popping stash into new branch...`);
                    await execAsync('git stash pop', { cwd });
                    vscode.window.showInformationMessage(`✨ T.R.O.N: Successfully carried your code changes over to the task!`);
                } catch (popErr) {
                    console.error(`❌ [GIT] Stash pop caused a conflict!`);
                    vscode.window.showErrorMessage(`T.R.O.N Warning: Git merge conflict when carrying changes over. Please resolve manually.`);
                }
            }

            tronProvider.refresh();
        } catch (error: any) {
            console.error(`❌ [WORKFLOW] startTaskFromTree encountered a fatal error:`, error);
            vscode.window.showErrorMessage(`T.R.O.N Error: ${error.message}`);
        }
    });

    let createCmd = vscode.commands.registerCommand('tron.createTaskOnly', async () => {
        console.log('🕹️ [CMD] tron.createTaskOnly triggered.');
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders){
            return false;
            }
            
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            const remoteUrl = stdout.trim();
            const repoMatch = remoteUrl.match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch){
            return false;
            }
            
            const repoName = repoMatch[1].replace('.git', '');
            
            const input = await vscode.window.showInputBox({ prompt: 'Enter new task name (Adds to "To Do"):' });
            if (!input) {
                console.log('❌ [CMD] createTaskOnly aborted (No input).');
                return false;
            }

            vscode.window.showInformationMessage(`T.R.O.N: Adding task to Basecamp...`);
            console.log(`📡 [NETWORK] Sending create-task payload...`);
            
            // 🌟 FIX: Removed getApiUrl() from path
            await axios.post(`/api/create-task`, {
                taskInput: input,
                repoName: repoName
            });
            
            console.log(`✅ [NETWORK] Task successfully created.`);
            vscode.window.showInformationMessage(`✅ T.R.O.N: Task added to To Do!`);
            tronProvider.refresh();
        } catch (error: any) {
            console.error(`❌ [WORKFLOW] createTaskOnly failed:`, error.message);
            vscode.window.showErrorMessage(`T.R.O.N Error: ${error.message}`);
        }
    });

    let viewReviewCmd = vscode.commands.registerCommand('tron.viewAIReview', async (task: any) => {
        console.log(`🕹️ [CMD] tron.viewAIReview triggered for Task ID: ${task?.id || task?.taskId}`);
        const taskId = task.id || task.taskId; 
        if (taskId === 'CREATE_NEW'){
            return false;
            }

        try {
            vscode.window.showInformationMessage(`T.R.O.N: Fetching AI Review...`);
            console.log(`📡 [NETWORK] Fetching AI review for task ${taskId}...`);
            // 🌟 FIX: Removed getApiUrl() from path
            const response = await axios.get(`/api/review/${taskId}`);
            const reviewText = response.data.review;
            console.log(`✅ [NETWORK] Review fetched successfully.`);

            const panel = vscode.window.createWebviewPanel(
                'tronAIReview', 
                `AI Review: TASK-${taskId}`, 
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>T.R.O.N. AI Code Review</title>
                    <style>
                        :root {
                            --card-bg: var(--vscode-editorWidget-background);
                            --card-border: var(--vscode-widget-border);
                            --text-muted: var(--vscode-descriptionForeground);
                        }
                        body { 
                            font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                            padding: 32px 24px; 
                            line-height: 1.6; 
                            color: var(--vscode-editor-foreground); 
                            background-color: var(--vscode-editor-background);
                            max-width: 900px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 24px;
                            padding-bottom: 16px;
                            border-bottom: 1px solid var(--vscode-panel-border);
                        }
                        .header-title {
                            display: flex;
                            align-items: center;
                            gap: 12px;
                        }
                        .header h2 { 
                            margin: 0;
                            font-size: 1.5rem;
                            font-weight: 600;
                            color: var(--vscode-editor-foreground);
                        }
                        .badge {
                            background-color: var(--vscode-badge-background);
                            color: var(--vscode-badge-foreground);
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 0.8rem;
                            font-weight: 600;
                            letter-spacing: 0.5px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        .review-card {
                            background: var(--card-bg);
                            border: 1px solid var(--card-border);
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                            overflow: hidden;
                        }
                        .review-card-header {
                            background: var(--vscode-editorGroupHeader-tabsBackground);
                            padding: 12px 20px;
                            border-bottom: 1px solid var(--card-border);
                            font-size: 0.85rem;
                            color: var(--text-muted);
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        pre { 
                            margin: 0;
                            padding: 24px; 
                            white-space: pre-wrap; 
                            word-wrap: break-word;
                            font-family: var(--vscode-editor-font-family), "Fira Code", monospace;
                            font-size: 0.95rem;
                            color: var(--vscode-editor-foreground);
                        }
                        .logo-icon {
                            font-size: 1.8rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="header-title">
                            <span class="logo-icon">💠</span>
                            <h2>T.R.O.N. Engine AI</h2>
                        </div>
                        <span class="badge">TASK-${taskId}</span>
                    </div>

                    <div class="review-card">
                        <div class="review-card-header">
                            <span>✨</span> Automated Code Analysis
                        </div>
                        <pre>${reviewText}</pre>
                    </div>
                </body>
                </html>
            `;
        } catch (error: any) {
            console.error(`❌ [NETWORK] AI Review Fetch failed:`, error?.response?.data || error.message);
            if (error.response && error.response.status === 404) {
                vscode.window.showInformationMessage(`T.R.O.N: No AI review generated for this task yet. Try pushing some code!`);
            } else {
                vscode.window.showErrorMessage(`T.R.O.N Error: Failed to fetch review. Is the API running?`);
            }
        }
    });

    // 🌟 THE AI POPUP TRAP
    let quickPickCmd = vscode.commands.registerCommand('tron.selectTaskPopup', async (args: any) => {
        console.log(`🕹️ [CMD] tron.selectTaskPopup triggered. AutoTrigger: ${args?.autoTrigger}`);
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders){
            return false;
            }
            
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout: remoteOut } = await execAsync('git config --get remote.origin.url', { cwd });
            const repoMatch = remoteOut.trim().match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch){
            return false;
            }
            
            const repoName = repoMatch[1].replace('.git', '');
            const encodedRepo = encodeURIComponent(repoName);
            console.log(`🔗 [POPUP] Extracting tasks for repo: ${repoName} (encoded: ${encodedRepo})`);

            // 🌟 1. API Call (WITH QUERY PARAM FIX AND REMOVED DOMAIN)
            console.log(`📡 [NETWORK] Checking if repo is mapped using: /api/project/tickets?repo=${encodedRepo}`);
            const ticketsRes = await axios.get(`/api/project/tickets?repo=${encodedRepo}`).catch((err) => {
                console.error(`❌ [NETWORK] Mapped tickets check failed:`, err.message);
                return { data: { isMapped: false, tickets: [] } };
            });

            console.log(`📋 [POPUP] Backend response: isMapped = ${ticketsRes.data.isMapped}`);
            if (ticketsRes.data.isMapped === false || ticketsRes.data.isMapped === undefined) {
                console.log(`🛑 [POPUP] Repo is unmapped. Aborting AI popup silently.`);
                return false; 
            }

            if (args && args.autoTrigger) {
                vscode.window.showInformationMessage(`T.R.O.N: Unlinked code changes detected. What are you working on?`);
            }

            console.log('🤖 [POPUP] Executing git diff to feed AI...');
            let codeDiff = "";
            try {
                const { stdout: diffOut } = await execAsync('git diff', { cwd });
                codeDiff = diffOut.trim();
                console.log(`🤖 [POPUP] Git diff captured (${codeDiff.length} characters)`);
            } catch (e) {
                console.log('⚠️ [POPUP] Git diff failed.');
            }

            let aiSuggestions: string[] = [];
            if (codeDiff) {
                try {
                    console.log(`📡 [NETWORK] Requesting AI task suggestions...`);
                    // 🌟 FIX: Removed getApiUrl() from path
                    const aiRes = await axios.post(`/api/suggest-tasks`, { codeDiff });
                    aiSuggestions = aiRes.data.suggestions || [];
                    console.log(`✅ [NETWORK] Received ${aiSuggestions.length} AI suggestions.`);
                } catch (e: any) {
                    console.error(`❌ [NETWORK] AI suggestion request failed:`, e.message);
                }
            }

            const tickets = ticketsRes.data.tickets || [];
            const quickPickItems: TaskQuickPickItem[] = [];

            aiSuggestions.forEach((suggestion: string) => {
                quickPickItems.push({
                    label: `✨ Create: "${suggestion}"`,
                    description: "AI Generated based on your code",
                    taskId: suggestion, 
                    rawTitle: suggestion
                });
            });

            tickets.forEach((t: any) => {
                quickPickItems.push({
                    label: `[${t.state || 'To Do'}] ${t.title}`,
                    description: `ID: ${t.id}`,
                    detail: t.description || "No description available",
                    taskId: t.id.toString(),
                    rawTitle: t.title
                });
            });

            if (quickPickItems.length === 0) {
                console.log('🛑 [POPUP] No tasks or suggestions found. Aborting.');
                vscode.window.showInformationMessage("T.R.O.N: No tasks or suggestions found.");
                return false;
            }

            const selection = await vscode.window.showQuickPick<TaskQuickPickItem>(quickPickItems, {
                placeHolder: 'Which task are you working on right now?',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selection) {
                console.log(`✅ [POPUP] User selected task: ${selection.rawTitle}`);
                vscode.commands.executeCommand('tron.startTaskFromTree', { id: selection.taskId, title: selection.rawTitle });
                return true; 
            } else {
                console.log('❌ [POPUP] User dismissed quick pick.');
                return false; 
            }

        } catch (error: any) {
            console.error(`❌ [POPUP] Fatal error in selectTaskPopup:`, error);
            return false;
        }
    });

    let hasPromptedForTask = false;
    let isCheckingBranch = false; 

    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.uri.scheme !== 'file'){
            return;
        }
        if (hasPromptedForTask || isCheckingBranch){
            return;
        }
        
        isCheckingBranch = true; 
        console.log(`💾 [EVENT] File saved: ${document.fileName}. Triggering branch check...`);

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) { isCheckingBranch = false; return; }
            const cwd = workspaceFolders[0].uri.fsPath;

            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
            const currentBranch = stdout.trim();
            console.log(`🌿 [EVENT] Current Branch: ${currentBranch}`);

            const branchRegex = /^([^/]+)\/(\d+)-(.+)$/;
            if (currentBranch === 'main' || currentBranch === 'master' || !branchRegex.test(currentBranch)) {
                console.log(`👀 [EVENT] Non-TRON branch detected. Launching popup...`);
                hasPromptedForTask = true; 
                await vscode.commands.executeCommand('tron.selectTaskPopup', { autoTrigger: true });
            } else {
                console.log(`✅ [EVENT] User is on a valid TRON branch. Staying silent.`);
                hasPromptedForTask = true;
            }
        } catch (error: any) {
            console.error(`❌ [EVENT] Git branch check failed:`, error.message);
        } finally {
            isCheckingBranch = false; 
        }
    });

    const workspaceFoldersList = vscode.workspace.workspaceFolders;
    if (workspaceFoldersList) {
        const cwd = workspaceFoldersList[0].uri.fsPath;
        const gitWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(cwd, '.git/HEAD')
        );
        
        gitWatcher.onDidChange(() => {
            console.log('🌿 [EVENT] Git HEAD changed. Resetting prompt flag.');
            hasPromptedForTask = false; 
        });

        context.subscriptions.push(gitWatcher);
    }

    context.subscriptions.push(refreshCmd, startTaskCmd, createCmd, viewReviewCmd, quickPickCmd, signInCmd, signOutCmd);
}

export function deactivate() {
    console.log('💤 [DEACTIVATION] TRON extension shutting down...');
}