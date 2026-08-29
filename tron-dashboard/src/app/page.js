import Link from 'next/link';
import LiveTerminal from '@/components/maximalist/LiveTerminal';
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

  const { data: orgMembers } = await supabase.from('organization_members').select('role, org_id').eq('user_id', user.id).limit(1);
  const isAdmin = orgMembers?.[0]?.role === 'admin';
  const orgId = orgMembers?.[0]?.org_id;

  const fullName = user?.user_metadata?.full_name || 'User';
  const companyName = user?.user_metadata?.company_name || 'Developers Workspace';

  // 🌟 FIX 1: Grab the active session token so the Go backend lets us in!
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
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
  // 👔 ADMIN VIEW (MISSION CONTROL)
  // ==========================================
  if (isAdmin) {
      return (
        <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
          
          <header className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mission Control</h1>
              <p className="text-sm text-gray-500 mt-1">Observability and Orchestration Engine</p>
            </div>
            <form action={handleLogout}>
              <button type="submit" className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors">
                Sign Out
              </button>
            </form>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="col-span-2 space-y-8">
              {/* Telemetry Output */}
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Telemetry
                </h2>
                <LiveTerminal initialLogs={[
                  { timestamp: new Date().toISOString(), type: 'info', message: 'Mission Control initialized.' },
                  { timestamp: new Date().toISOString(), type: 'info', message: 'Connected to TRON_V3 orchestration engine.' },
                  { timestamp: new Date().toISOString(), type: 'info', message: 'Waiting for webhook events...' },
                ]} />
              </section>

            </div>

            <div className="space-y-8">
              {/* Quick Stats / Node Graph Placeholder */}
              <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Active Workflows</span>
                    <span className="font-mono text-lg text-gray-900">{workflows.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Event Queue</span>
                    <span className="font-mono text-lg text-gray-900">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Go Workers</span>
                    <span className="font-mono text-sm text-emerald-600 font-medium">Healthy</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

        </div>
      );
  }

  // ==========================================
  // 💻 DEVELOPER VIEW (The Tailored Workspace)
  // ==========================================
  return <DevView fullName={fullName} companyName={companyName} workflows={workflows} handleLogout={handleLogout} />;
}