'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// 🛡️ THE VAULT: Secure Identity Management
// ==========================================
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
    const orgId = await getSecureAdminOrgId();
    
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // 1. Dual-Write: Sync with your Go Backend
    try {
        await fetch(`${process.env.BACKEND_URL}/api/repositories`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ ...payload, orgId })
        });
    } catch (e) {
        console.error("Failed to sync with Go Engine:", e);
    }

    // 2. Save securely to Supabase
    const { error } = await supabase.from('repositories').upsert({
        org_id: orgId,
        repo_name: payload.repoName,
        pm_provider: payload.pmProvider,
        pm_project_id: payload.pmProjectId,
        mapping: payload.mapping,
        communication_config: payload.communication_config
    }, { onConflict: 'org_id,repo_name,pm_provider' }); // 🌟 FIXED: Swapped back to comma-separated columns!

    // 🌟 UX FIX: Return the error securely instead of throwing it so Next.js doesn't crash!
    if (error) {
        console.error("Supabase Database Error:", error);
        return { success: false, message: error.message }; 
    }

    revalidatePath('/repositories');
    revalidatePath('/');

    return { success: true, message: "Workflow successfully mapped and secured!" };
}

export async function deleteWorkflowAction(formData) {
    const orgId = await getSecureAdminOrgId();
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
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${process.env.BACKEND_URL}/api/admin/github-repos?orgId=${orgId}`, { 
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
            cache: 'no-store' 
        });
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
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${process.env.BACKEND_URL}/api/admin/basecamp-projects?orgId=${orgId}`, { 
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
            cache: 'no-store' 
        });
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
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${process.env.BACKEND_URL}/api/admin/discord-status?orgId=${orgId}`, { 
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
            cache: 'no-store' 
        });
        const data = await res.json();
        return data.channels || [];
    } catch (e) {
        console.error("Proxy Error (Discord):", e);
        return [];
    }
}

export async function fetchBasecampColumns(projectId) {
    if (!projectId) {
        console.error("fetchBasecampColumns: projectId is required");
        return [];
    }

    try {
        const orgId = await getSecureAdminOrgId();
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const res = await fetch(`${process.env.BACKEND_URL}/api/admin/basecamp-columns`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ projectId, orgId }),
            cache: 'no-store',
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`fetchBasecampColumns: backend returned ${res.status}:`, errText);
            return [];
        }

        const data = await res.json();
        return (data.columns || []).map((col) => ({
            id: String(col.id),
            name: col.name || col.title || `Column ${col.id}`,
        }));
    } catch (e) {
        console.error("Proxy Error (Columns):", e);
        return [];
    }
}