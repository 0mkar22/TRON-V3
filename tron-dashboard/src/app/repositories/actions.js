'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveWorkflowAction(payload) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 🌟 THE VAULT: Securely grab the user's Org ID AND Role
    const { data: userData } = await supabase.from('users').select('org_id, role').eq('id', user.id).single();
    
    // 🌟 THE VAULT: Block developers instantly
    if (userData?.role !== 'admin') {
        throw new Error("Unauthorized: Only admins can manage workflows.");
    }

    const orgId = userData?.org_id;
    if (!orgId) throw new Error("No Organization ID found. Cannot map repository.");

    // 1. Dual-Write: Sync with your Render Engine
    try {
        await fetch('https://tron-v3.onrender.com/api/repositories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, orgId }) // Injecting Org ID securely!
        });
    } catch (e) {
        console.error("Failed to sync with Render Engine:", e);
    }

    // 2. Save securely to Supabase (Using the correct 'repositories' table and 'mapping' column)
    const { error } = await supabase.from('repositories').upsert({
        org_id: orgId,
        repo_name: payload.repoName,
        pm_provider: payload.pmProvider,
        pm_project_id: payload.pmProjectId,
        mapping: payload.mapping,
        communication_config: payload.communication_config
    }, { onConflict: 'repo_name' });

    if (error) throw new Error(error.message);

    // Refresh the pages to show the new data instantly
    revalidatePath('/repositories');
    revalidatePath('/');
    
    return { success: true, message: "Workflow successfully mapped and secured!" };
}

export async function deleteWorkflowAction(formData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 🌟 THE VAULT: Securely grab the user's Org ID AND Role
    const { data: userData } = await supabase.from('users').select('org_id, role').eq('id', user.id).single();
    
    // 🌟 THE VAULT: Block developers instantly
    if (userData?.role !== 'admin') {
        throw new Error("Unauthorized: Only admins can delete workflows.");
    }
    
    // Extract ID from the form data
    const workflowId = formData.get('workflowId');

    // Delete from repositories table
    await supabase.from('repositories').delete().match({ id: workflowId, org_id: userData.org_id });
    
    revalidatePath('/repositories');
    revalidatePath('/');
}

// ==========================================
// 🔌 RESTORED PROXY FETCHERS
// ==========================================

export async function fetchGithubRepos() {
    try {
        const res = await fetch('https://tron-v3.onrender.com/api/admin/github-repos', { cache: 'no-store' });
        const data = await res.json();
        return data.repos || [];
    } catch (e) {
        console.error("Proxy Error (GitHub):", e);
        return [];
    }
}

export async function fetchBasecampProjects() {
    try {
        const res = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-projects', { cache: 'no-store' });
        const data = await res.json();
        return data.projects || [];
    } catch (e) {
        console.error("Proxy Error (Basecamp):", e);
        return [];
    }
}

export async function fetchDiscordChannels() {
    try {
        const res = await fetch('https://tron-v3.onrender.com/api/admin/discord-status', { cache: 'no-store' });
        const data = await res.json();
        return data.channels || [];
    } catch (e) {
        console.error("Proxy Error (Discord):", e);
        return [];
    }
}

export async function fetchBasecampColumns(projectId) {
    try {
        const res = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId })
        });
        const data = await res.json();
        return data.columns || [];
    } catch (e) {
        console.error("Proxy Error (Columns):", e);
        return [];
    }
}