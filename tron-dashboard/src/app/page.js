import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LiveTerminal from '@/components/LiveTerminal';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAdmin = userData?.role === 'admin';

  const fullName = user?.user_metadata?.full_name || 'User';
  const companyName = user?.user_metadata?.company_name || 'Personal Workspace';

  let workflows = [];
  try {
      const res = await fetch('https://tron-v3.onrender.com/api/admin/dashboard-workflows', { cache: 'no-store' });
      if (res.ok) {
          const data = await res.json();
          workflows = data.workflows || [];
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
          {/* Admin Hero */}
          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
            <div className="text-center md:text-left relative z-10">
              <div className="inline-flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 tracking-wider mb-4 uppercase">
                <span>🏢</span><span>{companyName}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Welcome back, {fullName.split(' ')[0]}</h1>
              <p className="text-sm font-semibold text-indigo-600 mt-2 bg-indigo-50 inline-block px-3 py-1 rounded-md">
                Logged in as: {user?.email} <span className="ml-2 text-indigo-400 font-normal">(Admin)</span>
              </p>
              <p className="text-gray-500 mt-4 text-lg max-w-2xl">Your automated project management and AI code review engine is online and monitoring your repositories.</p>
            </div>
            <div className="mt-8 md:mt-0 flex flex-col items-center md:items-end space-y-5 relative z-10">
                <span className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm border border-emerald-100 shadow-sm">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2.5 animate-pulse"></span> Engine Active
                </span>
                <form action={handleLogout}><button type="submit" className="text-sm px-4 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg transition-colors">Log out</button></form>
            </div>
          </div>

          {/* Admin Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/integrations" className="block group h-full">
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
                <div className="flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">🔌</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Integrations</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-grow">Connect your PM tools (Basecamp) and link your communication channels.</p>
                <span className="text-indigo-600 font-bold text-sm mt-6 inline-block group-hover:underline">Configure Tools →</span>
              </div>
            </Link>
            <Link href="/repositories" className="block group h-full">
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
                <div className="flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">📦</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Workflow Mapping</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-grow">Map your GitHub repositories to your PM boards and configure automated columns.</p>
                <span className="text-emerald-600 font-bold text-sm mt-6 inline-block group-hover:underline">Map Repositories →</span>
              </div>
            </Link>
            <Link href="/activity" className="block group h-full">
              <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
                <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">🚀</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Mission Control</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-grow">Monitor live AI code reviews, Git webhook deliveries, and the background worker queue.</p>
                <span className="text-blue-600 font-bold text-sm mt-6 inline-block group-hover:underline">View Activity →</span>
              </div>
            </Link>
          </div>

          {/* Admin Table */}
          <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Active Workflows</h2>
                <Link href="/repositories" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Configure Mappings →</Link>
            </div>
            {workflows.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-dashed border-gray-300 text-center">
                    <span className="text-5xl mb-4 block opacity-50">🔌</span>
                    <h3 className="text-lg font-bold text-gray-900">No repositories connected yet</h3>
                    <p className="text-gray-500 text-sm mt-2">Head over to the Workflow Mapping tab to sync your first project.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Repository</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">PM Tool</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Broadcast Channel</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                                {workflows.map((workflow) => (
                                    <tr key={workflow.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center"><span className="text-2xl mr-4">🐙</span><div><div className="text-sm font-bold text-gray-900">{workflow.repo_name}</div></div></div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center"><span className="text-xl mr-3">⛺</span><span className="text-sm font-semibold text-gray-700 capitalize">{workflow.pm_provider}</span></div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                             {workflow.communication_config?.channel_id ? (
                                                <div className="flex items-center"><span className="text-xl mr-3">🎮</span><span className="text-sm font-semibold text-indigo-700 capitalize bg-indigo-50 px-2 py-1 rounded-md">Discord</span></div>
                                              ) : <span className="text-sm font-medium text-gray-400 italic bg-gray-50 px-2 py-1 rounded-md border border-gray-100">Muted</span>}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right">
                                            <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider mr-4">Active</span>
                                            <Link href="/repositories" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Configure ➔</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
          </div>
        </div>
      );
  }

  // ==========================================
  // 💻 DEVELOPER VIEW (The Tailored Workspace)
  // ==========================================
  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans space-y-8 pb-16">
      
      {/* Dev Hero & Metrics */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
        <div className="p-8 sm:p-10 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center relative">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
            <div className="text-center md:text-left relative z-10">
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Developer Workspace</h1>
              <p className="text-gray-500 mt-2 text-lg">Welcome aboard, {fullName.split(' ')[0]}. Your environment is synced to <span className="font-bold text-gray-700">{companyName}</span>.</p>
            </div>
            <div className="mt-6 md:mt-0 flex items-center space-x-4 relative z-10">
                <form action={handleLogout}>
                    <button type="submit" className="text-sm px-4 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold rounded-lg transition-colors border border-gray-200">Sign Out</button>
                </form>
            </div>
        </div>
        
        {/* Mock Dev Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 bg-gray-50/50">
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <span className="text-3xl mb-2">🔄</span>
                <span className="text-2xl font-bold text-gray-900">Active</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Webhook Status</span>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <span className="text-3xl mb-2">🤖</span>
                <span className="text-2xl font-bold text-gray-900">Enabled</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">AI Code Reviews</span>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <span className="text-3xl mb-2">⚡</span>
                <span className="text-2xl font-bold text-emerald-600">Secure</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Local Connection</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Editor Toolkit & Connected Repos */}
          <div className="lg:col-span-7 space-y-8">
              
              {/* VS Code Toolkit Banner */}
              <div className="bg-slate-900 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none transform translate-x-1/2 translate-y-1/2"></div>
                
                <div className="relative z-10">
                    <div className="inline-flex items-center justify-center bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-md text-xs font-bold tracking-wider mb-4 border border-indigo-500/30">
                        ESSENTIAL TOOLKIT
                    </div>
                    <h3 className="text-2xl font-bold flex items-center text-white mb-2">
                      <span className="mr-3 text-2xl">💻</span> TRON VS Code Extension
                    </h3>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed mb-6">
                      Sync your Basecamp tickets directly to your editor. Generate new branches with 1-click and automate column movements without leaving VS Code.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a href="/tron-vscode-0.0.1.vsix" download="tron-vscode-0.0.1.vsix" className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center shadow-lg">
                            <span className="mr-2">⬇️</span> Download .vsix
                        </a>
                        <div className="flex items-center px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-300 text-xs font-mono">
                            Press F1 → &apos;T.R.O.N: Sign In&apos;
                        </div>
                    </div>
                </div>
              </div>

              {/* Developer Repositories Table */}
              <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                 <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                     <h2 className="text-lg font-bold text-gray-900">Your Connected Workspaces</h2>
                 </div>
                 {workflows.length === 0 ? (
                     <div className="p-8 text-center text-gray-500 text-sm">No repositories have been assigned by an admin.</div>
                 ) : (
                     <ul className="divide-y divide-gray-50">
                         {workflows.map((workflow) => (
                             <li key={workflow.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                 <div className="flex items-center">
                                     <span className="text-3xl mr-4 drop-shadow-sm">🐙</span>
                                     <div>
                                         <p className="font-bold text-gray-900">{workflow.repo_name}</p>
                                         <div className="flex items-center mt-1 space-x-2">
                                             <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">⛺ {workflow.pm_provider}</span>
                                             <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shadow-sm">
                                                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span> Syncing
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                                 <a href={`https://github.com/${workflow.repo_name}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg transition-all">
                                     View Code ↗
                                 </a>
                             </li>
                         ))}
                     </ul>
                 )}
              </div>
          </div>

          {/* 🌟 NEW: Real-time Mission Control Activity Feed */}
          <div className="lg:col-span-5 h-full">
              <LiveTerminal />
          </div>
      </div>
    </div>
  );
}