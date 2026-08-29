import Link from 'next/link';
import React from 'react';

export default function AdminTable({ workflows }) {
  return (
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
                          {workflows.map((workflow) => {
                              // 🌟 DYNAMIC UI CHECK
                              const isJira = workflow.pm_provider === 'jira';
                              const isLinear = workflow.pm_provider === 'linear';
                              const pmIcon = isJira ? '📊' : (isLinear ? '⧓' : '⛺');

                              return (
                                  <tr key={workflow.id} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="px-6 py-5 whitespace-nowrap">
                                          <div className="flex items-center"><span className="text-2xl mr-4">🐙</span><div><div className="text-sm font-bold text-gray-900">{workflow.repo_name}</div></div></div>
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap">
                                          {/* 🌟 DYNAMIC PROVIDER ICON */}
                                          <div className="flex items-center">
                                              <span className="text-xl mr-3">{pmIcon}</span>
                                              <span className="text-sm font-semibold text-gray-700 capitalize">{workflow.pm_provider}</span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap">
                                          {/* 🌟 SLACK & DISCORD DYNAMIC BADGES */}
                                          {workflow.communication_config?.provider === 'slack' ? (
                                              <div className="flex items-center">
                                                  <span className="text-xl mr-3">💬</span>
                                                  <span className="text-sm font-semibold text-emerald-700 capitalize bg-emerald-50 px-2 py-1 rounded-md">Slack</span>
                                              </div>
                                          ) : workflow.communication_config?.channel_id ? (
                                              <div className="flex items-center">
                                                  <span className="text-xl mr-3">🎮</span>
                                                  <span className="text-sm font-semibold text-indigo-700 capitalize bg-indigo-50 px-2 py-1 rounded-md">Discord</span>
                                              </div>
                                          ) : (
                                              <span className="text-sm font-medium text-gray-400 italic bg-gray-50 px-2 py-1 rounded-md border border-gray-100">Muted</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-5 whitespace-nowrap text-right">
                                          <span className="px-3 py-1 inline-flex text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider mr-4">Active</span>
                                          <Link href="/repositories" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Configure ➔</Link>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}
