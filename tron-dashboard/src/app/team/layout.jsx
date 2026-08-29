import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function TeamLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // 1. Check their role
    const { data: userData } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .then(({data, error}) => ({ data: data?.[0], error }));

    // 🌟 2. THE BOUNCER: Kick out developers instantly
    if (userData?.role !== 'admin') {
        redirect('/');
    }

    // 3. If they are an admin, render the Team page!
    return <>{children}</>;
}