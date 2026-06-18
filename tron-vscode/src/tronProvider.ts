import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const getApiUrl = () => vscode.workspace.getConfiguration('tron').get<string>('backendUrl') || 'https://tron-v3-1.onrender.com';

// 1. Define the exact shape of a Ticket coming from the Go backend
export interface TronTicket {
    id: string;
    title: string;
    state: string;
    description?: string;
}

// 2. Extend the base TreeItem so we don't have to use (item as any)
export class TaskTreeItem extends vscode.TreeItem {
    taskId?: string;
    rawTitle?: string;

    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

export class TronProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;
    private supabase: any;

    constructor(supabaseClient: any) {
        this.supabase = supabaseClient;

        // 🌟 SAFE REFRESH: Listen to text editor changes (this covers 99% of file switching)
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); 
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return []; 
        }

        const { data: { session } } = await this.supabase.auth.getSession();

        if (!session) {
            const signInItem = new vscode.TreeItem("🔒 Please Sign In", vscode.TreeItemCollapsibleState.None);
            signInItem.description = "Click here to authenticate";
            signInItem.command = { command: 'tron.signIn', title: 'Sign In' };
            return [signInItem];
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [new vscode.TreeItem("Open a workspace to see tasks")];
        }

        // 🌟 DETECTOR: Resolve exact workspace folder safely
        let cwd = '';

        if (vscode.window.activeTextEditor) {
            const activeWorkspace = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (activeWorkspace) {
                cwd = activeWorkspace.uri.fsPath;
            }
        }

        // If single root, it's safe to default to the workspace root when no files are open
        if (!cwd && workspaceFolders.length === 1) {
            cwd = workspaceFolders[0].uri.fsPath;
        }

        // If it's multi-root and no folder context can be safely extracted, ask user to explicitly focus a file
        if (!cwd) {
            const multiRootItem = new vscode.TreeItem("📂 Click any code file to sync tasks", vscode.TreeItemCollapsibleState.None);
            multiRootItem.description = "Multi-root workspace detected";
            return [multiRootItem];
        }

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

        try {
            const encodedRepo = encodeURIComponent(repoName);
            const response = await axios.get(`/api/project/tickets?repo=${encodedRepo}`);
            
            if (response.data.isMapped === false) {
                const unmappedItem = new vscode.TreeItem("⚠️ This repository is not mapped in TRON", vscode.TreeItemCollapsibleState.None);
                unmappedItem.description = "Link it in the TRON dashboard";
                return [unmappedItem];
            }

            const tickets: TronTicket[] = response.data.tickets || [];

            if (tickets.length === 0) {
                const emptyItem = new vscode.TreeItem("✅ No active tasks right now!", vscode.TreeItemCollapsibleState.None);
                return [emptyItem];
            }
            return tickets.map((t: TronTicket) => {
                // Use our custom TaskTreeItem class
                const item = new TaskTreeItem(`[${t.state}] ${t.title}`, vscode.TreeItemCollapsibleState.None);
                item.description = `ID: ${t.id}`;
                item.tooltip = t.description;
                item.contextValue = 'tronTask'; 
                
                // Strictly typed assignment (no more `as any`)
                item.taskId = t.id;
                item.rawTitle = t.title;
                
                item.command = {
                    command: 'tron.startTaskFromTree',
                    title: 'Start Task',
                    arguments: [{ taskId: t.id, rawTitle: t.title }] 
                };
                
                return item;
            });

        } catch (error: any) {
            console.error("Fetch error:", error);
            
            if (error.response?.status === 401) {
                 const authErrorItem = new vscode.TreeItem("⚠️ Session Expired", vscode.TreeItemCollapsibleState.None);
                 authErrorItem.command = { command: 'tron.signIn', title: 'Sign In' };
                 return [authErrorItem];
            }
            
            if (error.response?.status === 403) {
                const forbiddenItem = new vscode.TreeItem("⛔ Access Denied", vscode.TreeItemCollapsibleState.None);
                forbiddenItem.description = "You are not assigned to this workflow";
                return [forbiddenItem];
            }
            
            return [new vscode.TreeItem("Failed to load tasks. Is the backend mapped?")];
        }
    }
}