import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AdminHero from '@/components/AdminHero';
import AdminQuickActions from '@/components/AdminQuickActions';
import AdminTable from '@/components/AdminTable';
import DevView from '@/components/DevView';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return redirect('/login');

  const { data: userData } = await supabase.from('users').select('role, org_id').eq('id', user.id).single();
  const isAdmin = userData?.role === 'admin';
  const orgId = userData?.org_id;

  const fullName = user?.user_metadata?.full_name || 'User';
  const companyName = user?.user_metadata?.company_name || 'Developers Workspace';

  // 🌟 FIX 1: Grab the active session token so the Go backend lets us in!
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  const orgCookie = cookieStore.get('X-Org-ID')?.value;
  const activeOrgId = orgCookie || orgId;

  let workflows = [];
  try {
      // 🌟 FIX 2: Ensure we have the token, and use process.env.BACKEND_URL
      if (activeOrgId && token) {
          const res = await fetch(`${process.env.BACKEND_URL}/api/admin/dashboard-workflows?orgId=${activeOrgId}`, { 
              headers: {
                  'Authorization': `Bearer ${token}`, // Pass the VIP security badge to Go
                  'X-Org-ID': activeOrgId
              },
              cache: 'no-store' 
          });
          
          if (res.ok) {
              const data = await res.json();
              workflows = data.workflows || [];
          } else {
              const errText = await res.text();
              console.error(`Backend returned ${res.status}:`, errText);
          }
      }
  } catch (error) {
      console.error("Failed to fetch workflows:", error);
  }

  const handleLogout = async () => {
      'use server'
      const supabaseServer = await createClient();
      await supabaseServer.auth.signOut();
      redirect('/login');
  };

  // ==========================================
  // 👔 ADMIN VIEW
  // ==========================================
  if (isAdmin) {
      return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans space-y-10 pb-16">
          <AdminHero companyName={companyName} fullName={fullName} user={user} handleLogout={handleLogout} />
          <AdminQuickActions />
          <AdminTable workflows={workflows} />
        </div>
      );
  }

  // ==========================================
  // 💻 DEVELOPER VIEW (The Tailored Workspace)
  // ==========================================
  return <DevView fullName={fullName} companyName={companyName} workflows={workflows} handleLogout={handleLogout} />;
}