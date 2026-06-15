'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function assignDeveloperAction(formData) {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
        return { success: false, message: "Unauthorized: Please log in." };
    }

    const userId = formData.get('userId');
    const repositoryId = formData.get('repositoryId');

    // 1. Verify the current user is an Admin and get their Organization ID
    const { data: adminData } = await supabase
        .from('users')
        .select('org_id, role')
        .eq('id', session.user.id)
        .single();

    if (!adminData?.org_id || adminData.role !== 'admin') {
        return { success: false, message: "Unauthorized: Only administrators can assign projects." };
    }

    // 2. Insert into the new Join Table
    const { error: insertError } = await supabase
        .from('project_assignments')
        .insert({
            org_id: adminData.org_id,
            user_id: userId,
            repository_id: repositoryId,
            assigned_by: session.user.id
        });

    if (insertError) {
        // Catch the unique constraint error from the Go backend (idx_user_repo)
        if (insertError.code === '23505') {
            return { success: false, message: "This developer is already assigned to this workflow!" };
        }
        return { success: false, message: insertError.message };
    }

    // 3. Refresh the page data
    revalidatePath('/team');
    return { success: true, message: "Developer successfully assigned to workflow!" };
}