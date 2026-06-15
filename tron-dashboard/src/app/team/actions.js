export async function deleteAssignmentAction(formData) {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
        return { success: false, message: "Unauthorized." };
    }

    const assignmentId = formData.get('assignmentId');

    // 1. Verify Admin
    const { data: adminData } = await supabase
        .from('users')
        .select('org_id, role')
        .eq('id', session.user.id)
        .single();

    if (!adminData?.org_id || adminData.role !== 'admin') {
        return { success: false, message: "Unauthorized." };
    }

    // 2. Delete the assignment safely
    const { error } = await supabase
        .from('project_assignments')
        .delete()
        .match({ id: assignmentId, org_id: adminData.org_id });

    if (error) {
        return { success: false, message: error.message };
    }

    revalidatePath('/team');
    return { success: true };
}