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
    const orgId = await getSecureAdminOrgId();

    // 1. Dual-Write: Sync with your Render Engine
    try {
        await fetch('https://tron-v3.onrender.com/api/repositories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, orgId })
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
        const res = await fetch(`https://tron-v3.onrender.com/api/admin/discord-status?orgId=${orgId}`, { cache: 'no-store' });
        const data = await res.json();
        return data.channels || [];
    } catch (e) {
        console.error("Proxy Error (Discord):", e);
        return [];
    }
}

/**
 * Fetches Basecamp card table columns for a given project.
 *
 * Returns an array of { id: string, name: string } objects where `id` is the
 * Basecamp list/column ID that should be stored in the workflow mapping
 * (e.g. mapping.todo, mapping.branch_created, etc.).
 *
 * The backend admin route (/api/admin/basecamp-columns) resolves:
 *   1. The project's dock to find the card_table or kanban_board tool
 *   2. Follows `lists_url` if columns are paginated
 *   3. Returns each column's numeric Basecamp ID coerced to a string
 *
 * These string IDs are what get POSTed to Basecamp's move/create endpoints.
 */
export async function fetchBasecampColumns(projectId) {
    if (!projectId) {
        console.error("fetchBasecampColumns: projectId is required");
        return [];
    }

    try {
        const orgId = await getSecureAdminOrgId();

        const res = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send both projectId and orgId so the backend can look up
            // the correct Basecamp credentials from Supabase Vault.
            body: JSON.stringify({ projectId, orgId }),
            cache: 'no-store',
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`fetchBasecampColumns: backend returned ${res.status}:`, errText);
            return [];
        }

        const data = await res.json();

        // Normalise: guarantee every column has an `id` (string) and `name`
        const columns = (data.columns || []).map((col) => ({
            id: String(col.id),       // Basecamp IDs are large integers — keep as string
            name: col.name || col.title || `Column ${col.id}`,
        }));

        console.log(`fetchBasecampColumns: fetched ${columns.length} columns for project ${projectId}`);
        return columns;
    } catch (e) {
        console.error("Proxy Error (Columns):", e);
        return [];
    }
}