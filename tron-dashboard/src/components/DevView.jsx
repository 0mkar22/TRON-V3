import React from 'react';

export default function DevView({ fullName, companyName, workflows, handleLogout }) {
  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 font-sans space-y-8 pb-16">
      
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

      <div className="space-y-8">
          
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
                  Sync your PM tickets directly to your editor. Generate new branches with 1-click and automate column movements without leaving VS Code.
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
                     {workflows.map((workflow) => {
                         // 🌟 DYNAMIC UI CHECK FOR DEV VIEW
                         const isJira = workflow.pm_provider === 'jira';
                         const isLinear = workflow.pm_provider === 'linear';
                         const pmIcon = isJira ? '📊' : (isLinear ? '⧓' : '⛺');

                         return (
                             <li key={workflow.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                 <div className="flex items-center">
                                     <span className="text-3xl mr-4 drop-shadow-sm">🐙</span>
                                     <div>
                                         <p className="font-bold text-gray-900">{workflow.repo_name}</p>
                                         <div className="flex items-center mt-1 space-x-2">
                                             {/* 🌟 DYNAMIC PROVIDER ICON */}
                                             <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded capitalize">
                                                 {pmIcon} {workflow.pm_provider}
                                             </span>
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
                         );
                     })}
                 </ul>
             )}
          </div>
      </div>
    </div>
  );
}
