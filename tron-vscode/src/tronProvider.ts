import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const API_BASE_URL = 'https://tron-v3.onrender.com';

export class TronProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private supabase: any;

    // 🌟 V3: Pass Supabase into the Provider
    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return []; // We are keeping this a flat list for now
        }

        // 🌟 1. Check if the developer is authenticated!
        const { data: { session } } = await this.supabase.auth.getSession();

        if (!session) {
            // If they aren't logged in, show a Sign In button right in the sidebar!
            const signInItem = new vscode.TreeItem("🔒 Please Sign In", vscode.TreeItemCollapsibleState.None);
            signInItem.description = "Click here to authenticate";
            signInItem.command = {
                command: 'tron.signIn',
                title: 'Sign In'
            };
            return [signInItem];
        }

        // 🌟 2. If logged in, fetch the Git Repo Name
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [new vscode.TreeItem("Open a workspace to see tasks")];
        }

        const cwd = workspaceFolders[0].uri.fsPath;
        let repoName = '';

        try {
            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            const match = stdout.trim().match(/github\.com[:\/](.+?\.git|.+)/);
            if (match) {
                repoName = match[1].replace('.git', '');
            }
        } catch (error) {
            return [new vscode.TreeItem("Not a Git repository")];
        }

        if (!repoName) {
            return [new vscode.TreeItem("Could not detect GitHub repository")];
        }

        // 🌟 3. Fetch Tickets securely (Axios interceptor will attach the token)
        try {
            const encodedRepo = encodeURIComponent(repoName);
            const response = await axios.get(`${API_BASE_URL}/api/project/${encodedRepo}/tickets`);
            const tickets = response.data.tickets || [];

            if (tickets.length === 0) {
                const emptyItem = new vscode.TreeItem("✅ No active tasks right now!", vscode.TreeItemCollapsibleState.None);
                return [emptyItem];
            }

            return tickets.map((t: any) => {
                const item = new vscode.TreeItem(`[${t.state}] ${t.title}`, vscode.TreeItemCollapsibleState.None);
                item.description = `ID: ${t.id}`;
                item.tooltip = t.description;
                
                // Add the play button context value for the "Start Task" command
                item.contextValue = 'tronTask'; 
                
                // Store raw data for the command execution
                (item as any).taskId = t.id;
                (item as any).rawTitle = t.title;
                
                return item;
            });

        } catch (error: any) {
            console.error("Fetch error:", error);
            if (error.response?.status === 401) {
                 // Double-check fallback: if the backend rejects the token, prompt sign-in
                 const authErrorItem = new vscode.TreeItem("⚠️ Session Expired", vscode.TreeItemCollapsibleState.None);
                 authErrorItem.command = { command: 'tron.signIn', title: 'Sign In' };
                 return [authErrorItem];
            }
            return [new vscode.TreeItem("Failed to load tasks. Is the backend mapped?")];
        }
    }
}