import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  // 1. Initialize Supabase Server Client
  const supabase = await createClient();

  // 2. Securely fetch the logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  // Extract the metadata we saved during onboarding!
  const fullName = user?.user_metadata?.full_name || 'User';
  const companyName = user?.user_metadata?.company_name || 'Personal Workspace';

  // 3. Fetch Workflows directly on the server
  let workflows = [];
  try {
      const res = await fetch('https://tron-v3.onrender.com/api/admin/dashboard-workflows', {
          cache: 'no-store' 
      });
      if (res.ok) {
          const data = await res.json();
          workflows = data.workflows || [];
      }
  } catch (error) {
      console.error("Failed to fetch workflows:", error);
  }

  // SERVER ACTION: Log Out
  const handleLogout = async () => {
      'use server'
      const supabaseServer = await createClient();
      await supabaseServer.auth.signOut();
      redirect('/login');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans space-y-10 pb-16">
      
      {/* --- HERO / SYSTEM STATUS SECTION --- */}
      <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
        
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <div className="text-center md:text-left relative z-10">
          
          {/* Workspace Badge */}
          <div className="inline-flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 tracking-wider mb-4 uppercase">
            <span>🏢</span>
            <span>{companyName}</span>
          </div>

          {/* Personalized Welcome */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Welcome back, {fullName.split(' ')[0]}</h1>
          
          <p className="text-sm font-semibold text-indigo-600 mt-2 bg-indigo-50 inline-block px-3 py-1 rounded-md">
            Logged in securely as: {user?.email}
          </p>

          <p className="text-gray-500 mt-4 text-lg max-w-2xl">Your automated project management and AI code review engine is online and monitoring your repositories.</p>
        </div>
        
        <div className="mt-8 md:mt-0 flex flex-col items-center md:items-end space-y-5 relative z-10">
            <span className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm border border-emerald-100 shadow-sm">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2.5 animate-pulse"></span>
              Engine Active
            </span>
            
            <form action={handleLogout}>
                <button 
                  type="submit"
                  className="text-sm px-4 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg transition-colors"
                >
                  Log out
                </button>
            </form>
        </div>
      </div>

      {/* --- QUICK ACTIONS GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/integrations" className="block group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
            <div className="flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">🔌</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Integrations</h3>
            <p className="text-gray-500 text-sm leading-relaxed flex-grow">
              Connect your PM tools (Basecamp, Jira) and link your communication channels (Discord, Slack).
            </p>
            <span className="text-indigo-600 font-bold text-sm mt-6 inline-block group-hover:underline">Configure Tools →</span>
          </div>
        </Link>

        <Link href="/repositories" className="block group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-emerald-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Workflow Mapping</h3>
            <p className="text-gray-500 text-sm leading-relaxed flex-grow">
              Map your GitHub repositories to your PM boards and configure automated webhook column movements.
            </p>
            <span className="text-emerald-600 font-bold text-sm mt-6 inline-block group-hover:underline">Map Repositories →</span>
          </div>
        </Link>

        <Link href="/activity" className="block group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
            <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Mission Control</h3>
            <p className="text-gray-500 text-sm leading-relaxed flex-grow">
              Monitor live AI code reviews, Git webhook deliveries, and the Redis background worker queue.
            </p>
            <span className="text-blue-600 font-bold text-sm mt-6 inline-block group-hover:underline">View Activity →</span>
          </div>
        </Link>
      </div>

      {/* --- VS CODE EXTENSION BANNER --- */}
      <div className="bg-slate-900 rounded-2xl p-8 sm:p-10 shadow-xl text-white flex flex-col lg:flex-row items-center justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none transform translate-x-1/2 translate-y-1/2"></div>
        <div className="absolute left-0 top-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="mb-8 lg:mb-0 relative z-10 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center justify-center bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-md text-xs font-bold tracking-wider mb-4 border border-indigo-500/30">
                DEVELOPER TOOLS
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold flex items-center justify-center lg:justify-start text-white mb-3">
              <span className="mr-3 text-3xl">💻</span> VS Code Extension
            </h3>
            <p className="text-slate-400 mt-2 text-base leading-relaxed">
              Supercharge your local development. Install the official TRON extension to enable 1-click branch generation and automated Basecamp ticket synchronization directly from your editor.
            </p>
            <div className="mt-5 inline-block bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-lg">
                <p className="text-slate-300 text-xs font-mono">
                  $ code --install-extension tron.vsix
                </p>
            </div>
        </div>
        
        <div className="flex-shrink-0 relative z-10 w-full lg:w-auto">
           <a 
             href="/tron-vscode-0.0.1.vsix" 
             download="tron-vscode-0.0.1.vsix"
             className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center shadow-lg group"
           >
             <span className="mr-3 text-xl group-hover:-translate-y-1 transition-transform">⬇️</span> 
             Download .vsix
           </a>
        </div>
      </div>

      {/* --- ACTIVE WORKFLOWS SECTION --- */}
      <div>
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Active Workflows</h2>
              <Link href="/repositories" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  View All →
              </Link>
          </div>
          
          {workflows.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-dashed border-gray-300 text-center">
                  <span className="text-5xl mb-4 block opacity-50">🔌</span>
                  <h3 className="text-lg font-bold text-gray-900">No repositories connected yet</h3>
                  <p className="text-gray-500 text-sm mt-2">Head over to the Workflow Mapping tab to sync your first project.</p>
                  <Link href="/repositories" className="mt-6 inline-block bg-white border border-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                      Map Repository
                  </Link>
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
                                          <div className="flex items-center">
                                              <span className="text-2xl mr-4">🐙</span>
                                              <div>
                                                  <div className="text-sm font-bold text-gray-900">{workflow.repo_name || 'Unknown Repo'}</div>
                                                  <div className="text-xs text-gray-500 mt-0.5">GitHub</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap">
                                          <div className="flex items-center">
                                              <span className="text-xl mr-3">⛺</span>
                                              <span className="text-sm font-semibold text-gray-700 capitalize">{workflow.pm_provider || 'basecamp'}</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap">
                                          <div className="flex items-center">
                                              {workflow.communication_config && workflow.communication_config.channel_id ? (
                                              <>
                                                <span className="text-xl mr-3">🎮</span>
                                                <span className="text-sm font-semibold text-indigo-700 capitalize bg-indigo-50 px-2 py-1 rounded-md">
                                                  {workflow.communication_config.provider === 'discord_bot' ? 'Discord' : workflow.communication_config.provider}
                                                </span>
                                              </>
                                              ) : (
                                                <span className="text-sm font-medium text-gray-400 italic bg-gray-50 px-2 py-1 rounded-md border border-gray-100">Muted</span>
                                              )}
                                          </div>
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap text-right">
                                          <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                              Active
                                          </span>
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