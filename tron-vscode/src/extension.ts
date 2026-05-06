import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TronProvider } from './tronProvider';
import { createSupabaseClient } from './supabaseClient';

const execAsync = promisify(exec);
const API_BASE_URL = 'https://tron-v3.onrender.com';
const DAEMON_API_KEY = 'tron_v3_super_secret_key_123';
const SUPABASE_URL = 'https://kobhfwjnbmbtgcikeulp.supabase.co'; // ⚠️ ADD YOUR URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYmhmd2puYm1idGdjaWtldWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzU3NzIsImV4cCI6MjA5MjQxMTc3Mn0.mopgJImaUiLfxCxSW-VSCcGkr4rUtEYvOrHJDMZsL4A'; // ⚠️ ADD YOUR KEY

// 🌟 NEW: 24-Hour Expiry Constants
const LOGIN_EXPIRY_MS = 24 * 60 * 60 * 1000; 
const LOGIN_TIMESTAMP_KEY = 'tron.loginTimestamp';

interface TaskQuickPickItem extends vscode.QuickPickItem {
    taskId: string;
    rawTitle: string;
}

export function activate(context: vscode.ExtensionContext) {
    axios.defaults.headers.common['x-api-key'] = DAEMON_API_KEY;

    // 1. Initialize Secure Supabase Client
    const supabase = createSupabaseClient(context, SUPABASE_URL, SUPABASE_ANON_KEY);
    const tronProvider = new TronProvider(supabase);
    vscode.window.registerTreeDataProvider('tron-tickets', tronProvider);

    // 2. The 24-Hour Enforcer
    const enforceLoginExpiry = async () => {
        const loginTime = context.globalState.get<number>(LOGIN_TIMESTAMP_KEY);
        if (loginTime) {
            const timeElapsed = Date.now() - loginTime;
            if (timeElapsed > LOGIN_EXPIRY_MS) {
                // The 24-hour time bomb triggered!
                await supabase.auth.signOut();
                await context.globalState.update(LOGIN_TIMESTAMP_KEY, undefined); 
                tronProvider.refresh(); // Lock the sidebar
                vscode.window.showWarningMessage('T.R.O.N: Session expired (24 hours). Please sign in again with your Developer ID.');
            }
        }
    };

    // Check on startup & set background loop
    enforceLoginExpiry(); 
    const expiryCheckInterval = setInterval(enforceLoginExpiry, 5 * 60 * 1000); 
    context.subscriptions.push({ dispose: () => clearInterval(expiryCheckInterval) });

    // 3. Axios Interceptor: Attach Secure Token & Check Expiry before EVERY request
    axios.interceptors.request.use(async (config) => {
        await enforceLoginExpiry(); 
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
        return config;
    });

    // Startup Welcome Message
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            vscode.window.showInformationMessage(`T.R.O.N: Signed in as ${session.user.email}`);
        }
    });

    // --- AUTHENTICATION COMMANDS ---

    const signInCmd = vscode.commands.registerCommand('tron.signIn', async () => {
        const email = await vscode.window.showInputBox({ prompt: 'Enter your Developer ID (Email)', placeHolder: 'dev@company.com' });
        if (!email) { return; }
        
        const password = await vscode.window.showInputBox({ prompt: 'Enter your Password', password: true });
        if (!password) { return; }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            vscode.window.showErrorMessage(`T.R.O.N: Sign in failed — ${error.message}`);
        } else {
            // Start the 24-hour clock!
            await context.globalState.update(LOGIN_TIMESTAMP_KEY, Date.now());
            vscode.window.showInformationMessage(`T.R.O.N: Signed in successfully as ${data.user.email}. Fetching your tickets...`);
            tronProvider.refresh();
        }
    });

    const signOutCmd = vscode.commands.registerCommand('tron.signOut', async () => {
        await supabase.auth.signOut();
        // Kill the clock
        await context.globalState.update(LOGIN_TIMESTAMP_KEY, undefined); 
        vscode.window.showInformationMessage('T.R.O.N: Signed out.');
        tronProvider.refresh();
    });

    // --- WORKFLOW COMMANDS ---

    let refreshCmd = vscode.commands.registerCommand('tron.refreshTickets', () => {
        tronProvider.refresh();
        vscode.window.showInformationMessage('T.R.O.N: Tasks Refreshed');
    });

    let startTaskCmd = vscode.commands.registerCommand('tron.startTaskFromTree', async (task: any) => {
        try {
            const taskId = task.id || task.taskId;
            if (!taskId) {
                return;
            }

            const taskTitle = task.title || task.rawTitle || `Task ${taskId}`;

            const userChoice = await vscode.window.showWarningMessage(
                `Start working on "${taskTitle}"? \n\nThis will automatically stash your current work, create a new branch, and assign you on Basecamp.`,
                { modal: true }, 
                'Yes, Start Task'
            );

            if (userChoice !== 'Yes, Start Task') {
                return false;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            let gitUsername = 'dev';
            try {
                const { stdout: userOut } = await execAsync('git config user.name', { cwd });
                gitUsername = userOut.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            } catch (e) {
                // Ignore silent fallback
            }

            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            const remoteUrl = stdout.trim();
            const repoMatch = remoteUrl.match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch) {
                return;
            }
            const repoName = repoMatch[1].replace('.git', '');

            vscode.window.showInformationMessage(`T.R.O.N: Syncing with Basecamp...`);

            let resolvedId = taskId;
            try {
                const response = await axios.post(`${API_BASE_URL}/api/start-task`, {
                    taskInput: taskId,
                    repoName: repoName,
                    developer: gitUsername 
                });
                resolvedId = response.data.resolvedId; 
                vscode.window.showInformationMessage(`✅ T.R.O.N: Basecamp synchronized & assigned!`);
            } catch (apiError: any) {
                vscode.window.showErrorMessage(`T.R.O.N Backend Error: Could not sync with Basecamp.`);
                return; 
            }

            const rawTitle = task.title || task.rawTitle || 'task';
            const formattedDesc = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);
            const branchName = `${gitUsername}/${resolvedId}-${formattedDesc}`;
            
            vscode.window.showInformationMessage(`T.R.O.N: Safely moving you to ${branchName}...`);

            let stashed = false;
            try {
                const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd });
                if (statusOut.trim().length > 0) {
                    await execAsync('git stash push -m "TRON_AUTO_STASH"', { cwd });
                    stashed = true;
                }
            } catch (e) {
                // Proceed safely
            }

            try {
                await execAsync(`git rev-parse --verify ${branchName}`, { cwd });
                await execAsync(`git checkout ${branchName}`, { cwd });
                vscode.window.showInformationMessage(`✅ T.R.O.N: Resumed existing branch ${branchName}`);
            } catch (err) {
                await execAsync(`git checkout -b ${branchName}`, { cwd });
                vscode.window.showInformationMessage(`⏳ T.R.O.N: Pushing branch to trigger backend automation...`);
                await execAsync(`git push -u origin ${branchName}`, { cwd });
                vscode.window.showInformationMessage(`✅ T.R.O.N: Created and pushed new branch! Basecamp will auto-assign shortly.`);
            }

            if (stashed) {
                try {
                    await execAsync('git stash pop', { cwd });
                    vscode.window.showInformationMessage(`✨ T.R.O.N: Successfully carried your code changes over to the task!`);
                } catch (popErr) {
                    vscode.window.showErrorMessage(`T.R.O.N Warning: Git merge conflict when carrying changes over. Please resolve manually.`);
                }
            }

            tronProvider.refresh();

        } catch (error: any) {
            vscode.window.showErrorMessage(`T.R.O.N Error: ${error.message}`);
        }
    });

    let createCmd = vscode.commands.registerCommand('tron.createTaskOnly', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return false;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            const remoteUrl = stdout.trim();
            const repoMatch = remoteUrl.match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch) {
                return false;
            }
            const repoName = repoMatch[1].replace('.git', '');

            const input = await vscode.window.showInputBox({ prompt: 'Enter new task name (Adds to "To Do"):' });
            if (!input) {
                return false;
            }

            vscode.window.showInformationMessage(`T.R.O.N: Adding task to Basecamp...`);
            
            await axios.post(`${API_BASE_URL}/api/create-task`, {
                taskInput: input,
                repoName: repoName
            });
            
            vscode.window.showInformationMessage(`✅ T.R.O.N: Task added to To Do!`);
            tronProvider.refresh();

        } catch (error: any) {
            vscode.window.showErrorMessage(`T.R.O.N Error: ${error.message}`);
        }
    });

    let viewReviewCmd = vscode.commands.registerCommand('tron.viewAIReview', async (task: any) => {
        const taskId = task.id || task.taskId; 
        if (taskId === 'CREATE_NEW') {
                return false;
            } 

        try {
            vscode.window.showInformationMessage(`T.R.O.N: Fetching AI Review...`);
            const response = await axios.get(`${API_BASE_URL}/api/review/${taskId}`);
            const reviewText = response.data.review;

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
            if (error.response && error.response.status === 404) {
                vscode.window.showInformationMessage(`T.R.O.N: No AI review generated for this task yet. Try pushing some code!`);
            } else {
                vscode.window.showErrorMessage(`T.R.O.N Error: Failed to fetch review. Is the API running?`);
            }
        }
    });

    // 🌟 THE FIX: Re-engineered AI Popup Flow
    let quickPickCmd = vscode.commands.registerCommand('tron.selectTaskPopup', async (args: any) => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return false;
            }
            
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout: remoteOut } = await execAsync('git config --get remote.origin.url', { cwd });
            const repoMatch = remoteOut.trim().match(/github\.com[:\/](.+?\.git|.+)/);
            if (!repoMatch) {
                return false;
            }
            
            const repoName = repoMatch[1].replace('.git', '');
            const encodedRepo = encodeURIComponent(repoName);

            // 1. Fetch tickets FIRST to verify mapping status
            const ticketsRes = await axios.get(`${API_BASE_URL}/api/project/${encodedRepo}/tickets`).catch(() => ({ data: { isMapped: false, tickets: [] } }));

            // 2. Silently abort if the repo is not connected to the TRON Dashboard!
            // 🌟 THE FIX: Aggressively block if it's explicitly false OR if the backend is still running old code
            if (ticketsRes.data.isMapped === false || ticketsRes.data.isMapped === undefined) {
                return false; 
            }

            // 3. ONLY show the unlinked warning if it is an officially connected TRON repo
            if (args && args.autoTrigger) {
                vscode.window.showInformationMessage(`T.R.O.N: Unlinked code changes detected. What are you working on?`);
            }

            vscode.window.showInformationMessage('✨ T.R.O.N: Analyzing your uncommitted code...');

            // 4. Generate Diff
            let codeDiff = "";
            try {
                const { stdout: diffOut } = await execAsync('git diff', { cwd });
                codeDiff = diffOut.trim();
            } catch (e) {
                // Proceed safely
            }

            // 5. Ask AI for suggestions ONLY because we know this is a connected repo
            let aiSuggestions: string[] = [];
            if (codeDiff) {
                try {
                    const aiRes = await axios.post(`${API_BASE_URL}/api/suggest-tasks`, { codeDiff });
                    aiSuggestions = aiRes.data.suggestions || [];
                } catch (e) {}
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
                vscode.window.showInformationMessage("T.R.O.N: No tasks or suggestions found.");
                return false;
            }

            const selection = await vscode.window.showQuickPick<TaskQuickPickItem>(quickPickItems, {
                placeHolder: 'Which task are you working on right now?',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selection) {
                vscode.commands.executeCommand('tron.startTaskFromTree', { id: selection.taskId, title: selection.rawTitle });
                return true; 
            } else {
                return false; 
            }

        } catch (error) {
            return false;
        }
    });

    let hasPromptedForTask = false;
    let isCheckingBranch = false; 

    vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.uri.scheme !== 'file') {
            return;
        }
        if (hasPromptedForTask || isCheckingBranch) {
            return;
        }
        isCheckingBranch = true; 

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                isCheckingBranch = false;
                return;
            }
            const cwd = workspaceFolders[0].uri.fsPath;

            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
            const currentBranch = stdout.trim();

            const branchRegex = /^([^/]+)\/(\d+)-(.+)$/;
            if (currentBranch === 'main' || currentBranch === 'master' || !branchRegex.test(currentBranch)) {
                
                // 🌟 THE FIX: We mark it as prompted immediately, and we NEVER reset it!
                // If you hit escape, or if it's an unmapped repo, it will respect your choice and stay quiet.
                hasPromptedForTask = true; 
                
                await vscode.commands.executeCommand('tron.selectTaskPopup', { autoTrigger: true });
                
            } else {
                hasPromptedForTask = true;
            }
        } catch (error) {
            // Ignore Git errors
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
            hasPromptedForTask = false; 
        });

        context.subscriptions.push(gitWatcher);
    }

    context.subscriptions.push(refreshCmd, startTaskCmd, createCmd, viewReviewCmd, quickPickCmd, signInCmd, signOutCmd);
}

export function deactivate() {}