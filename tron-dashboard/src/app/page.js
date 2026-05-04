import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  // 1. Initialize Supabase Server Client
  const supabase = await createClient();

  // 2. Securely fetch the logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  // 🌟 Extract the metadata we saved during onboarding!
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
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Hero / System Status Section */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
        
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-green-50 rounded-full opacity-50 blur-2xl pointer-events-none"></div>

        <div className="text-center md:text-left relative z-10">
          
          {/* 🌟 New Workspace Badge */}
          <div className="inline-flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 tracking-wide mb-3 uppercase">
            <span>🏢</span>
            <span>{companyName}</span>
          </div>

          {/* 🌟 Personalized Welcome */}
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome back, {fullName}</h1>
          
          <p className="text-sm font-medium text-indigo-600 mt-2">
            Logged in securely as: {user?.email}
          </p>

          <p className="text-gray-500 mt-2 text-lg">Your automated project management and AI code review engine is online.</p>
        </div>
        
        <div className="mt-6 md:mt-0 flex flex-col items-center md:items-end space-y-4 relative z-10">
            <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm shadow-sm border border-green-200">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Engine Active
            </span>
            
            <form action={handleLogout}>
                <button 
                  type="submit"
                  className="text-sm px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-md transition-colors border border-red-200 shadow-sm"
                >
                  Log out
                </button>
            </form>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/integrations" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4 transition-transform group-hover:scale-110">🔌</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Integrations</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Connect your PM tools (Basecamp, Jira, Monday) and link your communication channels (Discord, Slack).
            </p>
          </div>
        </Link>

        <Link href="/repositories" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4 transition-transform group-hover:scale-110">📦</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Workflow Mapping</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Map your GitHub repositories to your PM boards and configure automated webhook column movements.
            </p>
          </div>
        </Link>

        <Link href="/activity" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4 transition-transform group-hover:scale-110">🚀</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Mission Control</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Monitor live AI code reviews, Git webhook deliveries, and the Redis background worker queue.
            </p>
          </div>
        </Link>
      </div>

      {/* VS Code Extension Banner */}
      <div className="bg-gray-900 rounded-xl p-8 shadow-lg text-white flex flex-col md:flex-row items-center justify-between border border-gray-800 mt-8 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 text-9xl pointer-events-none transform translate-x-1/4 translate-y-1/4">💻</div>
        <div className="mb-6 md:mb-0 relative z-10">
            <h3 className="text-xl font-bold flex items-center text-blue-400">
              <span className="mr-3 text-2xl">💻</span> VS Code Extension
            </h3>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
              Supercharge your local development. Install the official TRON extension to enable 1-click branch generation and automated Basecamp ticket synchronization directly from your editor.
            </p>
            <p className="text-gray-500 mt-3 text-xs font-mono">
              After downloading, install via terminal: <span className="text-gray-300 bg-gray-800 px-2 py-1 rounded">code --install-extension tron.vsix</span>
            </p>
        </div>
        <div className="flex-shrink-0 relative z-10">
           <a 
             href="/tron-vscode-0.0.1.vsix" 
             download="tron-vscode-0.0.1.vsix"
             className="bg-blue-600 hover:bg-blue-500 border border-blue-400 px-6 py-3 rounded-lg text-sm font-bold text-white transition-all flex items-center shadow-lg group"
           >
             <span className="mr-2 group-hover:animate-bounce">⬇️</span> 
             Download .vsix
           </a>
        </div>
      </div>

      {/* --- ACTIVE WORKFLOWS SECTION --- */}
      <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Active Workflows</h2>
          
          {workflows.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center shadow-sm">
                  <span className="text-4xl mb-3 block opacity-50">🔌</span>
                  <h3 className="text-lg font-semibold text-gray-700">No repositories connected yet</h3>
                  <p className="text-gray-500 text-sm mt-1">Head over to the Repositories tab to map your first workflow.</p>
              </div>
          ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Repository</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">PM Tool</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Broadcast Channel</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status & Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {workflows.map((workflow) => (
                              <tr key={workflow.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <span className="text-xl mr-3">📦</span>
                                          <div>
                                              <div className="text-sm font-bold text-gray-900">{workflow.repo_name || 'Unknown Repo'}</div>
                                              <div className="text-xs text-gray-500 font-mono">GitHub</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <span className="text-xl mr-2">🏕️</span>
                                          <span className="text-sm text-gray-700 capitalize">{workflow.pm_provider || 'basecamp'}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          {workflow.communication_config && workflow.communication_config.channel_id ? (
                                          <>
                                            <span className="text-xl mr-2">🎮</span>
                                            <span className="text-sm text-gray-700 capitalize">
                                              {workflow.communication_config.provider === 'discord_bot' ? 'Discord' : workflow.communication_config.provider}
                                            </span>
                                          </>
                                          ) : (
                                            <span className="text-sm text-gray-400 italic">Muted</span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 mr-4">
                                          Active
                                      </span>
                                      <Link href="/repositories" className="text-sm text-indigo-600 hover:text-indigo-900 font-bold transition-colors">
                                          Configure ➔
                                      </Link>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

    </div>
  );
}