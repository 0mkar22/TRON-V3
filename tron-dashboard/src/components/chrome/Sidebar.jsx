'use client';
import Link from 'next/link';
import { LayoutDashboard, Cable, Workflow, Users, Activity } from 'lucide-react';

export default function Sidebar({ currentOrg }) {
  return (
    <aside className="w-64 h-screen bg-chrome-bg border-r border-chrome-border flex flex-col">
      <div className="p-4 border-b border-chrome-border">
        <h1 className="font-semibold text-gray-800 tracking-tight">TRON_V3</h1>
        <p className="text-xs text-gray-500 mt-1 truncate">{currentOrg?.name || 'Personal Workspace'}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <SidebarItem href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
        <SidebarItem href="/mission-control" icon={<Activity size={18} />} label="Mission Control" />
        <SidebarItem href="/integrations" icon={<Cable size={18} />} label="Integrations Hub" />
        <SidebarItem href="/workflows" icon={<Workflow size={18} />} label="Orchestrator" />
        <SidebarItem href="/team" icon={<Users size={18} />} label="Team Roster" />
      </nav>
    </aside>
  );
}

function SidebarItem({ href, icon, label }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  );
}
