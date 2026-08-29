import Link from 'next/link';
import React from 'react';

export default function AdminQuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Link href="/integrations" className="block group h-full">
        <div className="bg-white p-5 rounded-sm shadow-sm border border-gray-200 hover:border-gray-400 transition-colors h-full flex flex-col">
          <div className="flex items-center gap-3 mb-3">
             <div className="font-mono text-gray-400">01</div>
             <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Integrations Hub</h3>
          </div>
          <p className="text-gray-500 text-xs flex-grow">Manage webhooks, Slack bindings, and Jira credentials.</p>
          <span className="text-gray-900 font-mono text-[10px] uppercase mt-4 opacity-0 group-hover:opacity-100 transition-opacity">Configure →</span>
        </div>
      </Link>
      <Link href="/workflows" className="block group h-full">
        <div className="bg-white p-5 rounded-sm shadow-sm border border-gray-200 hover:border-gray-400 transition-colors h-full flex flex-col">
          <div className="flex items-center gap-3 mb-3">
             <div className="font-mono text-gray-400">02</div>
             <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Orchestrator</h3>
          </div>
          <p className="text-gray-500 text-xs flex-grow">Map GitHub events to PM board transitions.</p>
          <span className="text-gray-900 font-mono text-[10px] uppercase mt-4 opacity-0 group-hover:opacity-100 transition-opacity">Map Workflows →</span>
        </div>
      </Link>
      <Link href="/mission-control" className="block group h-full">
        <div className="bg-white p-5 rounded-sm shadow-sm border border-gray-200 hover:border-gray-400 transition-colors h-full flex flex-col">
          <div className="flex items-center gap-3 mb-3">
             <div className="font-mono text-gray-400">03</div>
             <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Mission Control</h3>
          </div>
          <p className="text-gray-500 text-xs flex-grow">View real-time telemetry and execution logs.</p>
          <span className="text-gray-900 font-mono text-[10px] uppercase mt-4 opacity-0 group-hover:opacity-100 transition-opacity">View Logs →</span>
        </div>
      </Link>
    </div>
  );
}
