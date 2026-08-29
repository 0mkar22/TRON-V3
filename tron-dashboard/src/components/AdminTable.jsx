import Link from 'next/link';
import React from 'react';

export default function AdminTable({ workflows }) {
  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6 border-b-4 border-black pb-4">
          <h2 className="text-4xl font-black uppercase text-black">Active Workflows</h2>
          <Link href="/repositories" className="btn-brutal bg-white px-4 py-2 text-black">Configure Mappings &rarr;</Link>
      </div>
      {workflows.length === 0 ? (
          <div className="bg-white p-12 border-4 border-black shadow-brutal text-center">
              <span className="font-mono text-xl font-bold uppercase text-black">NO REPOSITORIES CONNECTED</span>
          </div>
      ) : (
          <div className="bg-white border-4 border-black shadow-brutal-lg overflow-x-auto">
              <table className="w-full">
                  <thead className="bg-black text-white">
                      <tr>
                          <th className="px-6 py-4 text-left text-lg font-black uppercase">Repository</th>
                          <th className="px-6 py-4 text-left text-lg font-black uppercase">PM Tool</th>
                          <th className="px-6 py-4 text-left text-lg font-black uppercase">Broadcast Channel</th>
                          <th className="px-6 py-4 text-right text-lg font-black uppercase">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y-4 divide-black">
                      {workflows.map((workflow) => (
                          <tr key={workflow.id} className="hover:bg-brutal-green transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-xl font-bold font-mono text-black">{workflow.repo_name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-lg font-mono font-bold text-black uppercase bg-white px-3 py-1 border-2 border-black shadow-brutal">{workflow.pm_provider}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                  {workflow.communication_config?.provider === 'slack' ? (
                                      <span className="text-lg font-mono font-bold text-black uppercase bg-brutal-pink px-3 py-1 border-2 border-black shadow-brutal">slack</span>
                                  ) : workflow.communication_config?.channel_id ? (
                                      <span className="text-lg font-mono font-bold text-black uppercase bg-brutal-blue px-3 py-1 border-2 border-black shadow-brutal">discord</span>
                                  ) : (
                                      <span className="text-lg font-mono font-bold text-black uppercase bg-gray-200 px-3 py-1 border-2 border-black shadow-brutal">muted</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <span className="inline-flex items-center text-lg font-mono font-black px-3 py-1 bg-brutal-green text-black border-2 border-black shadow-brutal uppercase">
                                      ACTIVE
                                  </span>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
}
