import { SupabaseClient } from '@supabase/supabase-js';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getCurrentRepoName(): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { return null; }
    const cwd = folders[0].uri.fsPath;
    try {
        const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
        const match = stdout.trim().match(/github\.com[:\/](.+?)(\.git)?$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

export async function findCurrentRepository<T = Record<string, unknown>>(
    client: SupabaseClient
): Promise<T | null> {
    const repoName = await getCurrentRepoName();
    if (!repoName) { return null; }

    const { data, error } = await client
        .from('repositories')
        .select('*')
        .eq('repo_name', repoName)
        .single();

    if (error) { return null; }
    return data as T;
}
