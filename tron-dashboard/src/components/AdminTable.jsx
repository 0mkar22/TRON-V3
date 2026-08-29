import Link from 'next/link';
import React from 'react';

export default function AdminTable({ workflows }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Active Workflows</h2>
          <Link href="/workflows" className="text-[10px] font-mono font-bold text-gray-600 hover:text-gray-900 uppercase transition-colors">Configure Mappings →</Link>
      </div>
      {workflows.length === 0 ? (
          <div className="bg-white p-8 border border-gray-200 rounded-sm text-center">
              <span className="font-mono text-xs text-gray-400">NO REPOSITORIES CONNECTED</span>
          </div>
      ) : (
          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                              <th className="px-4 py-2 text-left text-[10px] font-mono text-gray-500 uppercase tracking-widest">Repository</th>
                              <th className="px-4 py-2 text-left text-[10px] font-mono text-gray-500 uppercase tracking-widest">PM Tool</th>
                              <th className="px-4 py-2 text-left text-[10px] font-mono text-gray-500 uppercase tracking-widest">Broadcast Channel</th>
                              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                          {workflows.map((workflow) => (
                              <tr key={workflow.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <div className="text-[13px] font-medium text-gray-900">{workflow.repo_name}</div>
                                      </div>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                      <span className="text-[11px] font-mono font-medium text-gray-700 capitalize bg-gray-100 px-2 py-0.5 rounded-sm border border-gray-200">{workflow.pm_provider}</span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                      {workflow.communication_config?.provider === 'slack' ? (
                                          <span className="text-[11px] font-mono font-medium text-brand-slack capitalize bg-purple-50 px-2 py-0.5 rounded-sm border border-purple-100">slack</span>
                                      ) : workflow.communication_config?.channel_id ? (
                                          <span className="text-[11px] font-mono font-medium text-brand-discord capitalize bg-indigo-50 px-2 py-0.5 rounded-sm border border-indigo-100">discord</span>
                                      ) : (
                                          <span className="text-[11px] font-mono font-medium text-gray-400 capitalize bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-100">muted</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-right">
                                      <span className="inline-flex items-center text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 border border-emerald-200">
                                          ACTIVE
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
  );
}
