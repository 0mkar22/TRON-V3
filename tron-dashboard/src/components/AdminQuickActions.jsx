import Link from 'next/link';
import React from 'react';

export default function AdminQuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Link href="/integrations" className="block group h-full">
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all duration-200 h-full flex flex-col">
          <div className="flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl mb-6 text-2xl group-hover:scale-110 transition-transform">🔌</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Integrations</h3>
          <p className="text-gray-500 text-sm leading-relaxed flex-grow">Connect your PM tools (Basecamp, Jira) and link your communication channels.</p>
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
  );
}
