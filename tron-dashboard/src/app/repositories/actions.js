'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// 🛡️ THE VAULT: Secure Identity Management
// ==========================================
/**
 * Ensures the requester is an authenticated Admin and securely retrieves their Organization ID.
 * This prevents Developer accounts or unauthenticated users from hitting your Render backend.
 */
async function getSecureAdminOrgId() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        throw new Error("Unauthorized: No active session.");
    }

    const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('org_id, role')
        .eq('id', user.id)
        .single();
    
    if (dbError || userData?.role !== 'admin') {
        throw new Error("Unauthorized: Only administrators can perform this action.");
    }
    
    if (!userData.org_id) {
        throw new Error("Configuration Error: No Organization ID found for this account.");
    }

    return userData.org_id;
}

// ==========================================
// 💾 WORKFLOW MUTATIONS
// ==========================================

export async function saveWorkflowAction(payload) {
    const orgId = await getSecureAdminOrgId(); // 🔒 Securely grab context

    // 1. Dual-Write: Sync with your Render Engine
    try {
        await fetch('https://tron-v3.onrender.com/api/repositories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, orgId }) // Injecting Org ID securely
        });
    } catch (e) {
        console.error("Failed to sync with Render Engine:", e);
    }

    // 2. Save securely to Supabase
    const supabase = await createClient();
    const { error } = await supabase.from('repositories').upsert({
        org_id: orgId,
        repo_name: payload.repoName,
        pm_provider: payload.pmProvider,
        pm_project_id: payload.pmProjectId,
        mapping: payload.mapping,
        communication_config: payload.communication_config
    }, { onConflict: 'repo_name' });

    if (error) throw new Error(error.message);

    revalidatePath('/repositories');
    revalidatePath('/');
    
    return { success: true, message: "Workflow successfully mapped and secured!" };
}

export async function deleteWorkflowAction(formData) {
    const orgId = await getSecureAdminOrgId(); // 🔒 Securely grab context
    const workflowId = formData.get('workflowId');
    
    const supabase = await createClient();
    await supabase.from('repositories').delete().match({ id: workflowId, org_id: orgId });
    
    revalidatePath('/repositories');
    revalidatePath('/');
}

// ==========================================
// 🔌 V3 SECURE PROXY FETCHERS (Multi-Tenant)
// ==========================================

export async function fetchGithubRepos() {
    try {
        const orgId = await getSecureAdminOrgId();
        // 🌟 FIX: Append orgId as a query parameter so the backend knows whose PAT to use
        const res = await fetch(`https://tron-v3.onrender.com/api/admin/github-repos?orgId=${orgId}`, { cache: 'no-store' });
        const data = await res.json();
        return data.repos || [];
    } catch (e) {
        console.error("Proxy Error (GitHub):", e);
        return [];
    }
}

export async function fetchBasecampProjects() {
    try {
        const orgId = await getSecureAdminOrgId();
        // 🌟 FIX: Append orgId as a query parameter
        const res = await fetch(`https://tron-v3.onrender.com/api/admin/basecamp-projects?orgId=${orgId}`, { cache: 'no-store' });
        const data = await res.json();
        return data.projects || [];
    } catch (e) {
        console.error("Proxy Error (Basecamp):", e);
        return [];
    }
}

export async function fetchDiscordChannels() {
    try {
        const orgId = await getSecureAdminOrgId();
        // 🌟 FIX: Append orgId as a query parameter
        const res = await fetch(`https://tron-v3.onrender.com/api/admin/discord-status?orgId=${orgId}`, { cache: 'no-store' });
        const data = await res.json();
        return data.channels || [];
    } catch (e) {
        console.error("Proxy Error (Discord):", e);
        return [];
    }
}

export async function fetchBasecampColumns(projectId) {
    try {
        const orgId = await getSecureAdminOrgId();
        const res = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, orgId }) // 🌟 FIX: Inject orgId into the POST body
        });
        const data = await res.json();
        return data.columns || [];
    } catch (e) {
        console.error("Proxy Error (Columns):", e);
        return [];
    }
}