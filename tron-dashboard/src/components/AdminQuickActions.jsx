import Link from 'next/link';
import React from 'react';

export default function AdminQuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
      <Link href="/integrations" className="block group">
        <div className="bg-brutal-blue border-4 border-black p-6 shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all flex flex-col h-full">
          <h3 className="text-3xl font-black uppercase text-black mb-4 border-b-4 border-black pb-2">Integrations</h3>
          <p className="font-mono text-black font-bold flex-grow mb-6">Manage webhooks, Slack bindings, and Jira credentials.</p>
          <span className="btn-brutal bg-white px-4 py-2 text-center">Configure &rarr;</span>
        </div>
      </Link>
      <Link href="/repositories" className="block group">
        <div className="bg-brutal-pink border-4 border-black p-6 shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all flex flex-col h-full">
          <h3 className="text-3xl font-black uppercase text-black mb-4 border-b-4 border-black pb-2">Orchestrator</h3>
          <p className="font-mono text-black font-bold flex-grow mb-6">Map GitHub events to PM board transitions.</p>
          <span className="btn-brutal bg-white px-4 py-2 text-center">Map Workflows &rarr;</span>
        </div>
      </Link>
      <Link href="/activity" className="block group">
        <div className="bg-brutal-green border-4 border-black p-6 shadow-brutal hover:shadow-brutal-lg hover:-translate-y-1 active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all flex flex-col h-full">
          <h3 className="text-3xl font-black uppercase text-black mb-4 border-b-4 border-black pb-2">Mission Control</h3>
          <p className="font-mono text-black font-bold flex-grow mb-6">View real-time telemetry and execution logs.</p>
          <span className="btn-brutal bg-white px-4 py-2 text-center">View Logs &rarr;</span>
        </div>
      </Link>
    </div>
  );
}
