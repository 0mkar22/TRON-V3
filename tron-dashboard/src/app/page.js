"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  // 1. Dashboard State
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Fetch Active Workflows on Load
  useEffect(() => {
      const fetchWorkflows = async () => {
          try {
              // ⚠️ Ensure this matches your live Render URL
              const res = await fetch('https://tron-v3.onrender.com/api/admin/dashboard-workflows');
              if (res.ok) {
                  const data = await res.json();
                  setWorkflows(data.workflows || []);
              }
          } catch (error) {
              console.error("Failed to fetch workflows:", error);
          } finally {
              setIsLoading(false);
          }
      };

      fetchWorkflows();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Hero / System Status Section */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome to T.R.O.N. V3</h1>
          <p className="text-gray-500 mt-2 text-lg">Your automated project management and AI code review engine is online.</p>
        </div>
        <div className="mt-6 md:mt-0">
            <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm shadow-sm">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Engine Active
            </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Integrations Card */}
        <Link href="/integrations" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4">🔌</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Integrations</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Connect your PM tools (Basecamp, Jira, Monday) and link your communication channels (Discord, Slack).
            </p>
          </div>
        </Link>

        {/* Repositories Card */}
        <Link href="/repositories" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Repositories</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Map your GitHub repositories to your PM boards and configure automated webhook column movements.
            </p>
          </div>
        </Link>

        {/* Mission Control Card */}
        <Link href="/activity" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full flex flex-col">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Mission Control</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed flex-grow">
              Monitor live AI code reviews, Git webhook deliveries, and the Redis background worker queue.
            </p>
          </div>
        </Link>

      </div>

      {/* VS Code Extension Banner */}
      <div className="bg-gray-900 rounded-xl p-8 shadow-lg text-white flex flex-col md:flex-row items-center justify-between border border-gray-800 mt-8">
        <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-bold flex items-center text-blue-400">
              <span className="mr-3 text-2xl">💻</span> VS Code Extension
            </h3>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
              Maximize your workflow. Install the TRON VSIX file in your editor to enable 1-click branch creation, automatic code stashing, and Basecamp developer auto-assignment.
            </p>
        </div>
        <div className="flex-shrink-0">
           <div className="bg-gray-800 border border-gray-700 px-4 py-2 rounded text-sm font-mono text-gray-300">
             npm run build
           </div>
        </div>
      </div>

      {/* --- 🌟 NEW: ACTIVE WORKFLOWS SECTION --- */}
      <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Active Workflows</h2>
          
          {isLoading ? (
              <div className="text-center py-10 text-gray-400 animate-pulse">Loading engine diagnostics...</div>
          ) : workflows.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center shadow-sm">
                  <span className="text-4xl mb-3 block">🔌</span>
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
                              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
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
                                          {/* Check if the JSONB column exists AND has a channel_id inside it */}
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
                                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                          Active
                                      </span>
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